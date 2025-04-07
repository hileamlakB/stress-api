import { MetricsPanel } from '../../MetricsPanel';
import { DemoMetricsPanel } from '../../DemoMetricsPanel';
import { useWizard } from '../WizardContext';

export function ResultsStep() {
  const { activeTestId } = useWizard();
  
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              {activeTestId 
                ? 'Your stress test is running. Live metrics are displayed below.'
                : 'No active test is running. Start a test to see live metrics.'}
            </p>
          </div>
        </div>
      </div>
      
      {activeTestId ? (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Live Test Metrics</h2>
            <p className="text-sm text-gray-500">Test ID: {activeTestId}</p>
          </div>
          <MetricsPanel testId={activeTestId} />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Example Visualization</h2>
            <p className="text-sm text-gray-500">This is how your metrics will look during a load test</p>
          </div>
          <DemoMetricsPanel />
        </div>
      )}
    </div>
  );
} 