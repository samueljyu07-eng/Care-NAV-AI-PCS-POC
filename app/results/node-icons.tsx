import {
  Activity,
  Battery,
  BatteryLow,
  Bike,
  Bone,
  CalendarCheck,
  Dumbbell,
  Eye,
  Focus,
  Footprints,
  Glasses,
  House,
  ListOrdered,
  MessageCircle,
  MessageCircleQuestion,
  Moon,
  Pause,
  PersonStanding,
  RotateCw,
  SlidersHorizontal,
  Stethoscope,
  Sun,
  SunMoon,
  Target,
  User,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import stepIcons from "../../data/step-icons.json";

const PRACTITIONER_ICONS: Record<string, LucideIcon> = {
  optometrist: Eye,
  vision_therapist: Glasses,
  physiotherapist: Activity,
  vestibular_physio: PersonStanding,
  gp_family_physician: Stethoscope,
  sports_medicine_physician: Dumbbell,
  sleep_specialist: Moon,
  psychologist: MessageCircle,
};

const PATHWAY_ICONS: Record<string, LucideIcon> = {
  "Neck tension and sensory sensitivity": Activity,
  "Eye tracking, focusing and screen strain": Eye,
  "Balance, dizziness and visual motion": PersonStanding,
  "Energy and recovery after effort": Sun,
  "Symptoms triggered by exertion": Footprints,
  "Hormonal and body-system changes": Stethoscope,
};

const NAMED_ICONS: Record<string, LucideIcon> = {
  Battery,
  BatteryLow,
  Bike,
  Bone,
  CalendarCheck,
  Dumbbell,
  Eye,
  Focus,
  Footprints,
  House,
  ListOrdered,
  MessageCircleQuestion,
  Pause,
  PersonStanding,
  RotateCw,
  SlidersHorizontal,
  SunMoon,
  Target,
  UserRoundPlus,
  Users,
};

export function practitionerIcon(type: string): LucideIcon {
  return PRACTITIONER_ICONS[type] ?? User;
}

export function stepTileIcon(
  stepId: string | null | undefined,
  practitionerType: string,
): LucideIcon {
  const iconName = stepId ? stepIcons[stepId as keyof typeof stepIcons] : undefined;
  if (iconName && NAMED_ICONS[iconName]) {
    return NAMED_ICONS[iconName];
  }
  return practitionerIcon(practitionerType);
}

export function pathwayIcon(name: string): LucideIcon {
  return PATHWAY_ICONS[name] ?? User;
}
