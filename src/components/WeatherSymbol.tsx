import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CircleHelp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { describeWeather } from "../services/weatherCodes";
import type { WeatherIcon } from "../services/weatherCodes";
const icons: Record<WeatherIcon, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  "cloud-sun": CloudSun,
  "cloud-moon": CloudMoon,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
  unknown: CircleHelp,
};
export default function WeatherSymbol({ code }: { code: number | null }) {
  // A daily summary is not a nighttime observation; use the daytime symbol.
  const Icon = icons[describeWeather(code, true).icon];
  return <Icon size={28} aria-hidden="true" />;
}
