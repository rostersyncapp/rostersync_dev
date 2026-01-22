"use client";
import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";
import { createNoise3D } from "simplex-noise";

export const WavyBackground = ({
    children,
    className,
    containerClassName,
    colors,
    waveWidth,
    backgroundFill,
    blur = 10,
    speed = "fast",
    waveOpacity = 0.5,
    ...props
}: {
    children?: any;
    className?: string;
    containerClassName?: string;
    colors?: string[];
    waveWidth?: number;
    backgroundFill?: string;
    blur?: number;
    speed?: "slow" | "fast";
    waveOpacity?: number;
    [key: string]: any;
}) => {
    const noise = React.useMemo(() => createNoise3D(), []);
    let w: number,
        h: number,
        nt: number,
        i: number,
        x: number,
        ctx: any,
        canvas: any;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const getSpeed = () => {
        switch (speed) {
            case "slow":
                return 0.001;
            case "fast":
                return 0.002;
            default:
                return 0.001;
        }
    };

    const init = () => {
        canvas = canvasRef.current;
        if (!canvas) return; // Guard against null canvas
        ctx = canvas.getContext("2d");

        // High DPI Support
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        // Scale context to match
        ctx.scale(dpr, dpr);

        // Set logical values for calculation
        w = rect.width;
        h = rect.height;

        // Reset filter - We use CSS filter instead for performance
        ctx.filter = "none";

        nt = 0;

        window.onresize = function () {
            // Re-calculate on resize
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
            w = rect.width;
            h = rect.height;
            ctx.filter = "none";
        };
    };

    const waveColors = colors ?? [
        "#38bdf8",
        "#818cf8",
        "#c084fc",
        "#e879f9",
        "#22d3ee",
    ];
    const drawWave = (n: number, timestamp: number) => {
        // Use timestamp for smooth animation independent of frame rate
        // speed value roughly maps to frequency
        // Adjusted speed to match 60fps feel: 0.001 per frame @ 60fps ~= 0.00006 per ms
        // User requested slow down by half -> 0.001 / 0.0005. Reduced by 10% -> 0.00045. Reduced by 20% -> 0.00036. Reduced by another 20% -> 0.000288
        const time = timestamp * (speed === "fast" ? 0.001 : 0.000288);

        // Reset nt based on time
        nt = time;

        for (i = 0; i < n; i++) {
            ctx.beginPath();
            ctx.lineWidth = waveWidth || 50;
            ctx.strokeStyle = waveColors[i % waveColors.length];
            for (x = 0; x < w; x += 5) {
                var y = noise(x / 800, 0.3 * i, nt) * 100;
                ctx.lineTo(x, y + h * 0.5); // adjust for height, currently at 50% of the container
            }
            ctx.stroke();
            ctx.closePath();
        }
    };

    let animationId: number;
    const render = (timestamp: number) => {
        if (!ctx) return;

        // Solid background to prevent flashing/transparency issues
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = backgroundFill || "black";
        ctx.fillRect(0, 0, w, h);

        // Draw waves with specified opacity
        ctx.globalAlpha = waveOpacity || 0.5;
        drawWave(5, timestamp);
        animationId = requestAnimationFrame(render);
    };

    useEffect(() => {
        init();
        // Start animation loop
        animationId = requestAnimationFrame(render);
        return () => {
            cancelAnimationFrame(animationId);
            window.onresize = null; // Cleanup resize listener
        };
    }, [backgroundFill, waveOpacity, colors, blur, speed, waveWidth]);

    return (
        <div
            className={cn(
                "h-full flex flex-col items-center justify-center pointer-events-none",
                containerClassName
            )}
        >
            <canvas
                className="absolute inset-0 !z-[-1] !pointer-events-none"
                ref={canvasRef}
                id="canvas"
                style={{
                    filter: `blur(${blur}px)`, // Use CSS filter everywhere
                    width: '100%',
                    height: '100%'
                }}
            ></canvas>
            <div className={cn("relative z-10", className)} {...props}>
                {children}
            </div>
        </div>
    );
};
