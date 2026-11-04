import { createFileRoute } from "@tanstack/react-router";
import { UncWheelScreen } from "@/components/unc/UncWheelScreen";

export const Route = createFileRoute("/unc")({
  head: () => ({
    meta: [{ title: "Your UNC5 · AIME Imagi-Nation" }],
  }),
  component: UncWheelScreen,
});
