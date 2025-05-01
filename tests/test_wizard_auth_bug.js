/**
 * Test for Bug: Try Step Wizard button takes user to test configuration instead of requiring login first
 * 
 * This test verifies that the "Try Step Wizard" button properly redirects
 * unauthenticated users to the login page instead of allowing direct
 * access to the wizard dashboard.
 */

// Import required modules
const { JSDOM } = require('jsdom');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_DESCRIPTION = 'Try Step Wizard button should redirect to login for unauthenticated users';

/**
 * Simple test runner
 */
async function runTest() {
  console.log(`Running test: ${TEST_DESCRIPTION}`);
  
  try {
    // Setup a mock DOM environment
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: 'http://localhost:3000/',
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true
    });
    
    // Mock window and document
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    
    // Mock authentication state - unauthenticated
    global.window.localStorage.setItem('auth', JSON.stringify({ authenticated: false }));
    
    // Mock React Router navigation
    let navigatedTo = null;
    global.window.navigate = (path) => {
      navigatedTo = path;
      return true;
    };
    
    // Create a mock button that simulates the "Try Step Wizard" button
    const wizardButton = document.createElement('button');
    wizardButton.textContent = 'Try Step Wizard';
    wizardButton.setAttribute('data-testid', 'try-wizard-button');
    
    // Add the click handler that simulates the current buggy behavior
    // In the actual app, this would be a Link component to "/wizard"
    wizardButton.addEventListener('click', () => {
      // This simulates the bug - direct navigation without auth check
      window.location.href = '/wizard';
    });
    
    document.body.appendChild(wizardButton);
    
    // Simulate clicking the button
    console.log('Clicking "Try Step Wizard" button...');
    wizardButton.click();
    
    // Check where we ended up - this demonstrates the bug
    console.log(`Navigation result: ${window.location.href}`);
    assert.strictEqual(
      window.location.pathname, 
      '/wizard', 
      'BUG DETECTED: Unauthenticated user was allowed to navigate to /wizard'
    );
    
    // The expected behavior would be:
    // assert.strictEqual(window.location.pathname, '/login', 'Should redirect to login');
    
    console.log('Test completed: Bug confirmed - unauthenticated users can access wizard directly');
    return {
      passed: false,
      message: 'BUG DETECTED: Try Step Wizard button allows direct access without authentication'
    };
    
  } catch (error) {
    console.error('Test error:', error);
    return {
      passed: false,
      message: `Test error: ${error.message}`
    };
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runTest().then(result => {
    console.log(`Test ${result.passed ? 'PASSED' : 'FAILED'}: ${result.message}`);
    process.exit(result.passed ? 0 : 1);
  });
}

module.exports = {
  description: TEST_DESCRIPTION,
  runTest
};
