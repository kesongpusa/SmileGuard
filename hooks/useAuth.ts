import { useState, useEffect } from "react";
import { CurrentUser, FormData } from "../types/index.ts";
import { supabase } from "../lib/supabase.ts";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen for auth state changes (auto-restores session on app restart)
  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      // Handle network error or storage corruption - prevent app freeze
      setLoading(false);
    });

    // Subscribe to future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Fetch the user's profile from the profiles table
  const fetchProfile = async (userId: string) => {
    console.log("🔍 Fetching profile for user:", userId);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, email, role")
        .eq("id", userId)
        .single();

      console.log("📊 Fetch result:", { hasData: !!data, hasError: !!error, errorCode: error?.code });

      if (error) {
        // If profile doesn't exist, try to get user metadata
        if (error.code === "PGRST116") {
          console.warn("⚠️ Profile not found, attempting to create from user metadata...");
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user || user.id !== userId) {
            console.error("❌ Current user mismatch or not found");
            setError("User not found.");
            setLoading(false);
            return;
          }

          const userName = user.user_metadata?.name || user.email?.split("@")[0] || "User";
          const userRole = user.user_metadata?.role || "patient";

          console.log("📝 Creating profile from metadata:", { userName, userRole });

          // Create the profile from user metadata
          const { data: createdProfile, error: createError } = await supabase
            .from("profiles")
            .insert({
              id: userId,
              name: userName,
              email: user.email || "",
              role: userRole,
              service: user.user_metadata?.service || "General",
            })
            .select()
            .single();

          if (createError) {
            console.error("❌ Error creating profile:", createError);
            // Don't set error, just try to continue with metadata
            console.log("💡 Continuing with user metadata instead");
            setCurrentUser({
              name: userName,
              email: user.email || "",
              role: userRole as "patient" | "doctor",
            });
          } else {
            console.log("✅ Profile created successfully");
            setCurrentUser({
              name: createdProfile?.name || userName,
              email: createdProfile?.email || user.email || "",
              role: (createdProfile?.role as "patient" | "doctor") || userRole,
            });
          }
        } else {
          console.error("❌ Profile fetch error:", error);
          throw error;
        }
      } else {
        console.log("✅ Profile found:", data);
        setCurrentUser({
          name: data.name,
          email: data.email,
          role: data.role,
        });
      }
    } catch (err) {
      // User-facing error handling instead of silent console.error
      const errorMessage = err instanceof Error ? err.message : "Failed to load profile. Please try again.";
      console.error("❌ Error in fetchProfile:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const login = async (
    email: string,
    password: string,
    role: "patient" | "doctor"
  ): Promise<CurrentUser> => {
    // Clear any previous errors
    setError(null);
    
    console.log("🔐 Starting login for:", email, "as", role);
    
    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("❌ Auth error:", error);
      throw new Error(error.message);
    }

    console.log("✅ Auth successful, user ID:", data.user.id);

    // Fetch the user's profile to verify their role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, email, role")
      .eq("id", data.user.id)
      .single();

    console.log("📊 Profile fetch result:", { profileExists: !!profile, hasError: !!profileError, errorCode: profileError?.code });

    // If profile doesn't exist, create it from user metadata
    if (profileError && profileError.code === "PGRST116") { // No rows found
      console.warn("⚠️ Profile not found for user, creating from metadata...");
      
      const userName = data.user.user_metadata?.name || email.split("@")[0];
      const userRole = data.user.user_metadata?.role || role;
      
      console.log("📝 Creating profile with:", { userName, userRole, userId: data.user.id });
      
      const { data: insertedProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          name: userName,
          email: data.user.email,
          role: userRole,
          service: data.user.user_metadata?.service || "General",
        })
        .select()
        .single();

      if (createError) {
        console.error("❌ Error creating profile:", createError);
        throw new Error(`Failed to create user profile: ${createError.message}`);
      }

      console.log("✅ Profile created successfully:", insertedProfile);

      return {
        name: insertedProfile?.name || userName,
        email: insertedProfile?.email || data.user.email || email,
        role: (insertedProfile?.role as "patient" | "doctor") || userRole,
      };
    }

    if (profileError) {
      console.error("❌ Error fetching profile:", profileError);
      throw new Error(`Profile error: ${profileError.message}`);
    }

    if (!profile) {
      console.error("❌ Profile is null even though no error");
      throw new Error("Profile not found. Please contact support.");
    }

    console.log("✅ Profile found:", profile);

    if (profile.role !== role) {
      // Sign them out since role doesn't match
      console.warn("⚠️ Role mismatch:", { expected: role, actual: profile.role });
      await supabase.auth.signOut();
      throw new Error(`This account is not registered as a ${role}. It's registered as a ${profile.role}.`);
    }

    return {
      name: profile.name,
      email: profile.email,
      role: profile.role,
    };
  };

  const register = async (formData: FormData,role: "patient" | "doctor"): Promise<CurrentUser> => {
    // Create the auth account in Supabase
    // Pass name, role, service, and medical intake as metadata — the database
    // trigger will automatically create the profile row from this data
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          name: formData.name,
          role: role,
          service: formData.service || "General",
          // Medical intake (patient only — will be empty obj for doctors)
          medical_intake: formData.medicalIntake ?? {},
        },
      },
    });
    
    if (error) {
      console.error("Registration error:", error);
      throw new Error(error.message);
    }
    

    if (!data.user) {
      throw new Error("Registration failed. Please try again.");
    }

    // Log successful registration for debugging
    console.log("Registration successful. User ID:", data.user.id, "Role:", role);
    if (role === "patient") {
      console.log("Medical intake submitted:", formData.medicalIntake);
    }
    

    return {
      name: formData.name,
      email: formData.email,
      role: role,
    };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setError(null);
  };

  return {
    currentUser,
    setCurrentUser,
    loading,
    error,
    setError,
    login,
    register,
    logout,
  };
}
