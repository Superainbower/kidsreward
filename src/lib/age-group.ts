export type AgeGroup = "3-6" | "6-10" | "10-14"

export function computeAgeGroup(birthYear: number, birthMonth: number): AgeGroup {
  const now = new Date()
  const age = now.getFullYear() - birthYear - (now.getMonth() + 1 < birthMonth ? 1 : 0)
  if (age <= 6) return "3-6"
  if (age <= 10) return "6-10"
  return "10-14"
}

export type AgeGroupConfig = {
  iconSize: number
  showText: boolean
  animationIntensity: "high" | "medium" | "low"
  colorSaturation: "full" | "muted"
}

export const ageGroupConfigs: Record<AgeGroup, AgeGroupConfig> = {
  "3-6":  { iconSize: 40, showText: false, animationIntensity: "high",   colorSaturation: "full" },
  "6-10": { iconSize: 32, showText: true,  animationIntensity: "medium", colorSaturation: "full" },
  "10-14":{ iconSize: 24, showText: true,  animationIntensity: "low",    colorSaturation: "muted" },
}
