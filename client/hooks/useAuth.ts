"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
      }
      setLoading(false);
    }
    
    getUser();
  }, [router]);

  return { user, loading };
}
