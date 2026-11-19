"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.email("Please enter a valid email"),
  subject: z.string().trim().min(3, "Add a short subject").max(160),
  body: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(4000),
});
type Values = z.infer<typeof schema>;

const API = process.env.NEXT_PUBLIC_API_URL;

const field = "mt-1.5 w-full rounded-[14px] bg-surface-2 px-4 py-3 ring-1 ring-line outline-none focus:ring-2 focus:ring-focus";

export function ContactForm({ className }: { className?: string }) {
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    setState("idle");
    if (!API) {
      setState("error");
      setError("The contact form isn’t connected yet. Please try again later.");
      return;
    }
    try {
      const res = await fetch(`${API}/v1/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.status === 429) throw new Error("You’ve sent several messages already. Please wait an hour and try again.");
      if (!res.ok) throw new Error("We couldn’t send your message. Please try again.");
      setState("sent");
      reset();
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "We couldn’t send your message.");
    }
  };

  if (state === "sent") {
    return (
      <div role="status" className={cn("rounded-[28px] bg-surface-2 p-8 ring-1 ring-line", className)}>
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <p className="mt-3 font-display text-2xl font-semibold">Message received.</p>
        <p className="mt-1 text-muted">The AnnSetu team reads every message and replies by email.</p>
        <Button variant="ghost" size="md" className="mt-4 ring-1 ring-line" onClick={() => setState("idle")}>
          Send another
        </Button>
      </div>
    );
  }

  const err = (k: keyof Values) =>
    formState.errors[k] && (
      <span id={`c-${k}-err`} className="mt-1 block text-sm text-danger">
        {formState.errors[k]?.message}
      </span>
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className={cn("rounded-[28px] bg-surface p-6 ring-1 ring-line md:p-8", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Name
          <input {...register("name")} autoComplete="name" className={field} aria-invalid={!!formState.errors.name} aria-describedby="c-name-err" />
          {err("name")}
        </label>
        <label className="block text-sm font-medium">
          Email
          <input {...register("email")} type="email" autoComplete="email" className={field} aria-invalid={!!formState.errors.email} aria-describedby="c-email-err" />
          {err("email")}
        </label>
      </div>
      <label className="mt-4 block text-sm font-medium">
        Subject
        <input {...register("subject")} className={field} aria-invalid={!!formState.errors.subject} aria-describedby="c-subject-err" />
        {err("subject")}
      </label>
      <label className="mt-4 block text-sm font-medium">
        Message
        <textarea {...register("body")} rows={5} className={field} aria-invalid={!!formState.errors.body} aria-describedby="c-body-err" />
        {err("body")}
      </label>
      {state === "error" && (
        <p role="alert" className="mt-4 rounded-[14px] bg-coral/15 px-4 py-3 text-sm">
          {error}
        </p>
      )}
      <Button type="submit" variant="solid" size="lg" arrow className="mt-6" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
