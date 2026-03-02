"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/providers/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/api/auth/login", {
        email,
        password,
      });

      // ✅ OLD LOGIC: store via AuthProvider
      login(res.data.token, res.data.user);

      // ✅ OLD LOGIC: redirect
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid login credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Full background */}
      <Image
        src="/branding/showroom.jpg"
        alt="Gupta Auto Agency Showroom"
        fill
        priority
        className="object-cover"
      />

      {/* Corporate overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/80" />

      {/* Content */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6">
        {/* Brand header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="bg-white rounded-2xl p-4 shadow-xl ring-1 ring-black/5 animate-[floatSlow_6s_ease-in-out_infinite]">
            <Image
              src="/branding/hero.png"
              alt="Hero"
              width={140}
              height={80}
              className="h-14 w-auto"
            />
          </div>

          <h1 className="mt-5 text-white text-4xl font-extrabold tracking-wide">
            GUPTA AUTO AGENCY
          </h1>
          <p className="text-white/80 text-sm mt-1">Hero MotoCorp • Umaria</p>
        </div>

        {/* Login Card (enterprise + luxury subtle animation) */}
        <div className="w-full max-w-md rounded-3xl bg-white/10 border border-white/20 backdrop-blur-2xl p-8
                        shadow-[0_20px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/10
                        animate-[fadeIn_700ms_ease-out] hover:shadow-[0_30px_110px_rgba(0,0,0,0.55)]
                        transition-shadow duration-300">
          <h2 className="text-2xl font-bold text-white">Sign in</h2>
          <p className="text-sm text-white/80 mt-1">
            Access your showroom management system
          </p>

          {error ? (
            <div className="mt-4 rounded-xl bg-red-500/20 border border-red-300/30 text-red-100 px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-white/90 font-medium">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
                autoComplete="username"
                className="mt-1 w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3
                           text-white placeholder:text-white/60 outline-none
                           focus:ring-2 focus:ring-white/50"
              />
            </div>

            <div>
              <label className="block text-sm text-white/90 font-medium">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                className="mt-1 w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3
                           text-white placeholder:text-white/60 outline-none
                           focus:ring-2 focus:ring-white/50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-red-600 py-3 text-white font-semibold
                         hover:bg-red-700 active:scale-[0.99]
                         transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-xs text-white/70 flex justify-between">
            <span>Secure login</span>
            <span>v1</span>
          </div>
        </div>

        <p className="mt-6 text-xs text-white/60">Authorized staff access only</p>
      </div>
    </div>
  );
}
