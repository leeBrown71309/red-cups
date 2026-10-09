import type { CSSProperties, ReactNode } from "react";
import { AudioToggles } from "./audio-controls";
import { FlowStepper, type FlowStepId } from "./flow-stepper";
import { FullscreenButton } from "./fullscreen-button";
import { GameLogo } from "./game-logo";
import { RedCupIcon } from "../icons/item-icon";

/** Where the spotlight rests for each chapter (a shift of its own width): it glides on as the pawn walks. */
const SPOT_SHIFT: Record<FlowStepId, string> = { players: "-10%", map: "33%", draft: "73%" };

/** The party backdrop: a dark stage, a warm spotlight, confetti and a few cups drifting by. */
export function FlowBackdrop({ step }: { step: FlowStepId }) {
  return (
    <div className="flow__backdrop" aria-hidden="true">
      <span className="flow__spot" style={{ "--spot-shift": SPOT_SHIFT[step] } as CSSProperties} />
      <span className="flow__drift flow__drift--a">
        <RedCupIcon size={64} />
      </span>
      <span className="flow__drift flow__drift--b">
        <RedCupIcon size={40} />
      </span>
      <span className="flow__drift flow__drift--c">
        <RedCupIcon size={52} />
      </span>
      <span className="flow__star flow__star--a">✦</span>
      <span className="flow__star flow__star--b">✦</span>
      <span className="flow__star flow__star--c">✦</span>
    </div>
  );
}

interface FlowShellProps {
  /** The chapter on show; null for the pages before the first chapter (the online home): no stepper then. */
  step: FlowStepId | null;
  /** Gets the stepper's "back to a done chapter" handler; omit to freeze the trail. */
  onStepBack?: (step: FlowStepId) => void;
  /** Left of the logo: the way back out of the flow. */
  leading?: ReactNode;
  /** Right of the header, before the sound buttons. */
  corner?: ReactNode;
  children: ReactNode;
}

/** The full-screen page every chapter of the pre-game lives in: backdrop, header with stepper, body. */
export function FlowShell({ step, onStepBack, leading, corner, children }: FlowShellProps) {
  return (
    <main className="flow" data-step={step ?? "none"}>
      <FlowBackdrop step={step ?? "players"} />
      <header className="flow__head">
        <div className="flow__lead">
          {leading}
          <GameLogo compact />
        </div>
        {step && <FlowStepper current={step} onBack={onStepBack} />}
        <div className="flow__corner">
          {corner}
          <AudioToggles />
          <FullscreenButton />
        </div>
      </header>
      <div className="flow__body">{children}</div>
    </main>
  );
}

/** The bottom bar of a chapter: what you can still do on the left, where you go next on the right. */
export function FlowFooter({ children }: { children: ReactNode }) {
  return <footer className="flow-foot">{children}</footer>;
}
