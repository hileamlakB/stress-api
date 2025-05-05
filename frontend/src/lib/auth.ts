import { supabase } from './supabase';

export async function signUp(email: string, password: string) {
  console.log("Starting signup process for:", email);
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    console.error("Signup error:", error);
    throw error;
  }

  console.log("Supabase signup response:", JSON.stringify(data, null, 2));

  // The definitive way to check if email verification is needed is:
  // 1. If session is null, verification is required
  // 2. If confirmation_sent_at exists, verification is required
  // 3. If email_confirmed_at is null/undefined, verification is required
  const needsEmailVerification = 
    data.session === null || 
    !!data.user?.confirmation_sent_at || 
    !data.user?.email_confirmed_at;
  
  console.log("Email confirmation status:", data?.user?.email_confirmed_at);
  console.log("Confirmation sent at:", data?.user?.confirmation_sent_at);
  console.log("Session exists:", !!data.session);
  console.log("Needs email verification:", needsEmailVerification);

  if (needsEmailVerification) {
    console.log("Returning verification needed response");
    return { 
      user: data.user, 
      needsEmailVerification: true,
      message: "Please check your email for a verification link" 
    };
  }

  console.log("No verification needed, returning normal response");
  return data;
}

/**
 * Resend verification email to the user
 * @param email The email address to send the verification link to
 * @returns Success message
 */
export async function resendVerificationEmail(email: string) {
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    }
  });
  
  if (error) {
    throw error;
  }
  
  return {
    success: true,
    message: "Verification email resent successfully"
  };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  return user;
}

/**
 * Sends a password reset email to the specified email address
 * @param email The email address to send the password reset link to
 * @returns The Supabase API response
 */
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Updates the user's password
 * @param newPassword The new password
 * @returns The Supabase API response
 */
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  
  if (error) {
    throw error;
  }
  
  return data;
}