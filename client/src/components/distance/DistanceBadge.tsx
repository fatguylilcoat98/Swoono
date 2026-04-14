import { useEffect, useRef, useState } from "react";
import { useRoomStore } from "../../state/roomStore";

// Ask the browser for the user's location, push it to the server every 5 min
// while mounted, and display the server-computed haversine distance to the
// partner. Raw coords never render — only the computed distance.

const LOCATION_STORAGE_KEY = "swoono:locationOptIn";
const PUSH_INTERVAL_MS = 5 * 60 * 1000;

type Permission = "unknown" | "prompt" | "granted" | "denied" | "unavailable";

function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  if (miles < 0.1) return "Right next to each other";
  if (miles < 10) return `${miles.toFixed(1)} mi apart`;
  if (miles < 1000) return `${Math.round(miles)} mi apart`;
  return `${Math.round(miles).toLocaleString()} mi apart`;
}

export default function DistanceBadge() {
  const pushLocation = useRoomStore((s) => s.pushLocation);
  const distanceMeters = useRoomStore((s) => s.distanceMeters);
  const partner = useRoomStore((s) =>
    s.peers.find((p) => p.clientId !== s.clientId),
  );

  const [permission, setPermission] = useState<Permission>(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return "unavailable";
    }
    return localStorage.getItem(LOCATION_STORAGE_KEY) === "granted"
      ? "granted"
      : "prompt";
  });
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (permission !== "granted" || !partner) return;

    const push = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          pushLocation(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy,
          );
        },
        (err) => {
          // If user has since revoked, drop back to prompt state.
          if (err.code === err.PERMISSION_DENIED) {
            localStorage.removeItem(LOCATION_STORAGE_KEY);
            setPermission("denied");
          }
        },
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
      );
    };

    push();
    intervalRef.current = window.setInterval(push, PUSH_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [permission, partner, pushLocation]);

  if (permission === "unavailable") return null;

  if (permission !== "granted") {
    if (!partner) return null; // hide until partner joins — nothing to compare to
    return (
      <button
        onClick={() => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              localStorage.setItem(LOCATION_STORAGE_KEY, "granted");
              setPermission("granted");
              pushLocation(
                pos.coords.latitude,
                pos.coords.longitude,
                pos.coords.accuracy,
              );
            },
            (err) => {
              if (err.code === err.PERMISSION_DENIED) {
                setPermission("denied");
              }
            },
            { enableHighAccuracy: false, timeout: 15_000 },
          );
        }}
        className="text-xs uppercase tracking-widest text-swoono-dim hover:text-swoono-accent transition-colors border border-white/10 px-3 py-1 rounded-full"
        title="Share your location to see how far apart you two are"
      >
        📍 Enable distance
      </button>
    );
  }

  if (distanceMeters === null) {
    return (
      <span className="text-xs uppercase tracking-widest text-swoono-dim">
        📍 Locating…
      </span>
    );
  }

  return (
    <span
      className="text-xs uppercase tracking-widest text-swoono-dim flex items-center gap-1"
      title="Approximate distance between you two"
    >
      <span className="text-swoono-accent">📍</span>
      <span className="text-swoono-ink font-medium">
        {formatDistance(distanceMeters)}
      </span>
    </span>
  );
}
