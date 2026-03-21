"use client";

import React, { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  durationSec?: number;
  message?: string;
  type?: string;
  onDone?: () => void;
};

type Particle = {
  id: number;
  left: string;
  top: string;
  delay: string;
  size: number;
};

export default function FestivalLoginOverlay({
  open,
  durationSec = 5,
  message = "",
  type = "diwali",
  onDone,
}: Props) {
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    setVisible(open);
  }, [open]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, durationSec * 1000);

    return () => clearTimeout(t);
  }, [visible, durationSec, onDone]);

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: `${5 + Math.random() * 90}%`,
      top: `${8 + Math.random() * 75}%`,
      delay: `${Math.random() * 1.8}s`,
      size: 6 + Math.floor(Math.random() * 14),
    }));
  }, [open, type]);

  if (!visible || type === "none") return null;

  const config = getFestivalConfig(type, message);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: config.overlayBackground,
          backdropFilter: "blur(2px)",
        }}
      />

      <div className="absolute inset-0">
        {type === "diwali" &&
          particles.map((p) => (
            <span
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: p.left,
                top: p.top,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animation: `fireworkBurst 1.6s ease-out ${p.delay} infinite`,
                background:
                  "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,214,10,1) 35%, rgba(255,120,0,1) 70%, rgba(255,0,0,0.15) 100%)",
                boxShadow:
                  "0 0 10px rgba(255,255,255,0.8), 0 0 18px rgba(255,140,0,0.9), 0 0 28px rgba(255,0,0,0.55)",
              }}
            />
          ))}

        {type === "navratri" && (
          <>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={`diya-${i}`}
                className="absolute flex flex-col items-center"
                style={{
                  left: `${5 + i * 8}%`,
                  bottom: `${12 + (i % 3) * 10}px`,
                  animation: `floatDiya ${3.2 + (i % 3) * 0.5}s ease-in-out ${i * 0.2}s infinite`,
                }}
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-4 h-6 bg-yellow-300 rounded-full blur-[1px] animate-pulse" />
                  <div className="absolute w-3 h-5 bg-orange-500 rounded-full opacity-90 blur-[0.5px]" />
                  <div className="absolute w-2 h-3 bg-white rounded-full opacity-60" />
                </div>

                <div className="w-10 h-5 bg-orange-700 rounded-b-full mt-1 shadow-[0_0_18px_rgba(255,140,0,0.5)] border border-orange-900/40" />
                <div className="w-8 h-2 bg-amber-600 rounded-full -mt-1" />
              </div>
            ))}

            {Array.from({ length: 28 }).map((_, i) => (
              <span
                key={`spark-${i}`}
                className="absolute rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 90}%`,
                  width: `${4 + Math.random() * 4}px`,
                  height: `${4 + Math.random() * 4}px`,
                  background: "radial-gradient(circle, rgba(255,230,120,1) 0%, rgba(255,180,0,0.85) 60%, rgba(255,180,0,0) 100%)",
                  opacity: 0.65,
                  animation: `aartiGlow ${2.2 + Math.random() * 1.6}s ease-in-out ${Math.random() * 2}s infinite`,
                  boxShadow: "0 0 10px rgba(255,200,0,0.65)",
                }}
              />
            ))}
          </>
        )}

        {type === "new_year" &&
          particles.map((p) => (
            <span
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: p.left,
                top: p.top,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animation: `confettiPop 1.8s ease-out ${p.delay} infinite`,
                background:
                  p.id % 4 === 0
                    ? "#FFD700"
                    : p.id % 4 === 1
                    ? "#00E5FF"
                    : p.id % 4 === 2
                    ? "#FF4D6D"
                    : "#FFFFFF",
                boxShadow: "0 0 10px rgba(255,255,255,0.5)",
              }}
            />
          ))}

        {type === "christmas" &&
          particles.map((p) => (
            <span
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: p.left,
                top: p.top,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animation: `snowFall 4s linear ${p.delay} infinite`,
                background: "rgba(255,255,255,0.95)",
                boxShadow: "0 0 8px rgba(255,255,255,0.7)",
              }}
            />
          ))}

        {type === "holi" &&
          particles.map((p) => (
            <span
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: p.left,
                top: p.top,
                width: `${p.size + 10}px`,
                height: `${p.size + 10}px`,
                animation: `colorBurst 1.7s ease-out ${p.delay} infinite`,
                background:
                  p.id % 5 === 0
                    ? "rgba(255,0,102,0.8)"
                    : p.id % 5 === 1
                    ? "rgba(0,204,255,0.8)"
                    : p.id % 5 === 2
                    ? "rgba(255,204,0,0.8)"
                    : p.id % 5 === 3
                    ? "rgba(102,255,102,0.8)"
                    : "rgba(153,102,255,0.8)",
                boxShadow: "0 0 16px rgba(255,255,255,0.25)",
              }}
            />
          ))}

        {type === "independence_day" &&
          particles.map((p) => (
            <span
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: p.left,
                top: p.top,
                width: `${p.size + 6}px`,
                height: `${p.size + 6}px`,
                animation: `triColorGlow 2s ease-in-out ${p.delay} infinite`,
                background:
                  p.id % 3 === 0
                    ? "rgba(255,153,51,0.85)"
                    : p.id % 3 === 1
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(19,136,8,0.85)",
                boxShadow: "0 0 16px rgba(255,255,255,0.35)",
              }}
            />
          ))}
      </div>

      <div className="absolute inset-x-0 top-12 flex justify-center px-4">
        <div
          className="rounded-2xl shadow-2xl px-6 py-4 text-center border"
          style={{
            background: config.cardBackground,
            borderColor: config.cardBorder,
          }}
        >
          <div
            className="text-3xl md:text-5xl font-extrabold mb-2"
            style={{ color: config.titleColor }}
          >
            {config.message}
          </div>
          <div className="text-sm md:text-base font-medium" style={{ color: config.subColor }}>
            Welcome to Showroom Dashboard
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fireworkBurst {
          0% {
            transform: scale(0.2);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          50% {
            transform: scale(1.8);
            opacity: 1;
          }
          100% {
            transform: scale(2.8);
            opacity: 0;
          }
        }

        @keyframes rocketRise {
          0% {
            transform: translateY(0) scaleY(0.7);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          80% {
            transform: translateY(-85vh) scaleY(1.1);
            opacity: 0.9;
          }
          100% {
            transform: translateY(-95vh) scaleY(1.2);
            opacity: 0;
          }
        }

        @keyframes floatDiya {
          0% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-14px);
          }
          100% {
            transform: translateY(0px);
          }
        }

        @keyframes aartiGlow {
          0% {
            opacity: 0.2;
            transform: scale(0.5);
          }
          50% {
            opacity: 1;
            transform: scale(1.4);
          }
          100% {
            opacity: 0.2;
            transform: scale(0.5);
          }
        }

        @keyframes garbaGlow {
          0% {
            transform: scale(0.6) rotate(0deg);
            opacity: 0.15;
          }
          50% {
            transform: scale(1.5) rotate(180deg);
            opacity: 1;
          }
          100% {
            transform: scale(0.8) rotate(360deg);
            opacity: 0.15;
          }
        }

        @keyframes confettiPop {
          0% {
            transform: translateY(40px) scale(0.4);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          60% {
            transform: translateY(-50px) scale(1.15) rotate(180deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-90px) scale(0.7) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes snowFall {
          0% {
            transform: translateY(-30px);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translateY(90vh);
            opacity: 0.2;
          }
        }

        @keyframes colorBurst {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          30% {
            opacity: 0.95;
          }
          60% {
            transform: scale(1.8);
            opacity: 0.9;
          }
          100% {
            transform: scale(2.6);
            opacity: 0;
          }
        }

        @keyframes triColorGlow {
          0% {
            transform: scale(0.5);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.6);
            opacity: 1;
          }
          100% {
            transform: scale(0.8);
            opacity: 0.2;
          }
        }
      `}</style>
    </div>
  );
}

function getFestivalConfig(type: string, customMessage?: string) {
  switch (type) {
    case "navratri":
      return {
        message: customMessage || "🪔 Happy Navratri",
        overlayBackground:
          "linear-gradient(to top, rgba(60,0,0,0.72), rgba(120,20,0,0.42), rgba(255,140,0,0.18))",
        cardBackground: "rgba(255, 248, 220, 0.95)",
        cardBorder: "rgba(255, 153, 51, 0.6)",
        titleColor: "#d35400",
        subColor: "#7a3e00",
      };

    case "new_year":
      return {
        message: customMessage || "🎉 Happy New Year",
        overlayBackground: "rgba(0, 24, 60, 0.36)",
        cardBackground: "rgba(255, 255, 255, 0.94)",
        cardBorder: "rgba(0, 229, 255, 0.5)",
        titleColor: "#0f4c81",
        subColor: "#374151",
      };

    case "christmas":
      return {
        message: customMessage || "🎄 Merry Christmas",
        overlayBackground: "rgba(10, 45, 20, 0.35)",
        cardBackground: "rgba(255, 255, 255, 0.94)",
        cardBorder: "rgba(220, 38, 38, 0.45)",
        titleColor: "#b91c1c",
        subColor: "#166534",
      };

    case "holi":
      return {
        message: customMessage || "🌈 Happy Holi",
        overlayBackground: "rgba(85, 0, 115, 0.28)",
        cardBackground: "rgba(255, 255, 255, 0.94)",
        cardBorder: "rgba(255, 0, 128, 0.35)",
        titleColor: "#c026d3",
        subColor: "#374151",
      };

    case "independence_day":
      return {
        message: customMessage || "🇮🇳 Happy Independence Day",
        overlayBackground: "rgba(0, 40, 20, 0.28)",
        cardBackground: "rgba(255, 255, 255, 0.96)",
        cardBorder: "rgba(19, 136, 8, 0.4)",
        titleColor: "#ea580c",
        subColor: "#166534",
      };

    case "diwali":
    default:
      return {
        message: customMessage || "🎆 Happy Diwali",
        overlayBackground: "rgba(0, 0, 0, 0.25)",
        cardBackground: "rgba(255, 255, 255, 0.92)",
        cardBorder: "rgba(255, 255, 255, 0.65)",
        titleColor: "#ea580c",
        subColor: "#374151",
      };
  }
}