"use client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./AuthContext";
import { WishlistProvider } from "./WishlistContext";
import { NotificationProvider } from "./NotificationContext";
import { MaintenanceGate } from "@/components/MaintenanceGate";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <MaintenanceGate>
          <WishlistProvider>
            <NotificationProvider>{children}</NotificationProvider>
          </WishlistProvider>
        </MaintenanceGate>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
