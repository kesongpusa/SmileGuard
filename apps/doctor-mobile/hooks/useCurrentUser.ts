import { useEffect, useState } from "react";
import { supabase } from "@smileguard/supabase-client";
import { CurrentUser } from "../types/index";

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session?.user) {
        console.log('🔐 JWT metadata:', session.user.user_metadata);
        console.log('🔐 JWT app_metadata:', session.user.app_metadata);
        
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name,
          role: session.user.user_metadata?.role,
        });
      }
    });
  }, []);

  return user;
}
