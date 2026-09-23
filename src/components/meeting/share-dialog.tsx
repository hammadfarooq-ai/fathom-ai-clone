"use client";

import { Copy, Globe, Lock, Mail, Scissors } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getPerson } from "@/data/people";
import type { Meeting } from "@/types";
import { AvatarStack } from "../ui/avatar";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Input, Switch } from "../ui/primitives";

export function ShareDialog({
  meeting,
  open,
  onOpenChange,
  onCreateClip,
}: {
  meeting: Meeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateClip: () => void;
}) {
  const [publicLink, setPublicLink] = useState(false);
  const [email, setEmail] = useState("");
  const internal = meeting.participants.filter((p) => !getPerson(p).external);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meetings/${meeting.id}`);
      toast.success("Meeting link copied");
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Share meeting" description={meeting.title}>
        <div className="space-y-5 p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\S+@\S+\.\S+$/.test(email)) {
                toast.error("Enter a valid email address");
                return;
              }
              toast.success("Summary shared", { description: `${email} will receive the recap and a link to the recording.` });
              setEmail("");
            }}
          >
            <label htmlFor="share-email" className="mb-1.5 block text-[13px] font-medium text-ink">
              Send the recap to a teammate
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                <Input id="share-email" type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
              </div>
              <Button type="submit" variant="primary">
                Send
              </Button>
            </div>
          </form>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3.5">
            <div className="flex items-center gap-3">
              <AvatarStack ids={internal} max={4} />
              <div>
                <p className="text-[13px] font-medium text-ink">Workspace members</p>
                <p className="text-xs text-muted">Everyone at Northstack who attended can view</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3.5">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-subtle text-muted">
                {publicLink ? <Globe className="size-4" /> : <Lock className="size-4" />}
              </span>
              <div>
                <p className="text-[13px] font-medium text-ink">{publicLink ? "Anyone with the link" : "Restricted"}</p>
                <p className="text-xs text-muted">
                  {publicLink ? "People outside Northstack can view the recap and recording" : "Only people with access can open this meeting"}
                </p>
              </div>
            </div>
            <Switch
              checked={publicLink}
              onCheckedChange={(v) => {
                setPublicLink(v);
                toast(v ? "Link sharing turned on" : "Link sharing turned off");
              }}
              label="Anyone with the link can view"
            />
          </div>

          <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
            <Button
              onClick={() => {
                onOpenChange(false);
                onCreateClip();
              }}
            >
              <Scissors /> Share a clip instead
            </Button>
            <Button variant="primary" onClick={copy}>
              <Copy /> Copy link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
