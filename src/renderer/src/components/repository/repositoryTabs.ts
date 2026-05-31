import {
  Bot,
  BookOpen,
  CircleDot,
  Code2,
  Gauge,
  GitPullRequest,
  MessageSquare,
  PlayCircle,
  Settings,
  SquareKanban,
  Tag,
  Users
} from "lucide-react";

import type { RepositoryTab } from "../../stores/uiStore";

export interface RepositoryTabDescriptor {
  key: RepositoryTab;
  label: string;
  icon: typeof Code2;
  routeOnly?: boolean;
  hiddenReason?: string;
}

export const repoTabs: RepositoryTabDescriptor[] = [
  { key: "code", label: "Code", icon: Code2 },
  { key: "issues", label: "Issues", icon: CircleDot },
  { key: "pulls", label: "Pull requests", icon: GitPullRequest },
  { key: "actions", label: "Actions", icon: PlayCircle },
  { key: "agents", label: "Agents", icon: Bot },
  { key: "discussions", label: "Discussions", icon: MessageSquare },
  { key: "projects", label: "Projects", icon: SquareKanban },
  { key: "releases", label: "Releases", icon: Tag },
  { key: "contributors", label: "Contributors", icon: Users },
  { key: "wiki", label: "Wiki", icon: BookOpen },
  { key: "securityQuality", label: "Security and Quality", icon: Gauge },
  { key: "settings", label: "Settings", icon: Settings }
];
