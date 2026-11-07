import { createFileRoute } from "@tanstack/react-router";
import { Garden } from "@/game/Garden";

export const Route = createFileRoute("/")({ component: Garden });
