CREATE TABLE "action_items" (
	"id" text PRIMARY KEY NOT NULL,
	"meeting_id" text NOT NULL,
	"title" text NOT NULL,
	"owner_id" text NOT NULL,
	"due_date" date NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"platform" text NOT NULL,
	"meeting_type" text NOT NULL,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calendar" text NOT NULL,
	"auto_record" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clips" (
	"id" text PRIMARY KEY NOT NULL,
	"meeting_id" text NOT NULL,
	"start_sec" integer NOT NULL,
	"end_sec" integer NOT NULL,
	"title" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "highlights" (
	"id" text PRIMARY KEY NOT NULL,
	"meeting_id" text NOT NULL,
	"transcript_entry_id" text,
	"start_sec" integer NOT NULL,
	"end_sec" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_participants" (
	"meeting_id" text NOT NULL,
	"person_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "meeting_participants_meeting_id_person_id_pk" PRIMARY KEY("meeting_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_sec" integer NOT NULL,
	"meeting_type" text NOT NULL,
	"platform" text NOT NULL,
	"host_id" text NOT NULL,
	"template" text DEFAULT 'general' NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"key_decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"takeaways" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recording_url" text,
	"source" text DEFAULT 'seed' NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"processing_started_at" timestamp with time zone,
	"processing_ready_at" timestamp with time zone,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A')
        || setweight(to_tsvector('english', coalesce(summary, '')), 'B')
        || setweight(jsonb_to_tsvector('english', key_decisions, '["string"]'), 'B')
        || setweight(jsonb_to_tsvector('english', takeaways, '["string"]'), 'C')
        || setweight(jsonb_to_tsvector('english', topics, '["string"]'), 'C')
        || setweight(jsonb_to_tsvector('english', tags, '["string"]'), 'C')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"color" text NOT NULL,
	"external" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"meeting_id" text NOT NULL,
	"position" integer NOT NULL,
	"start_sec" integer NOT NULL,
	"speaker_id" text NOT NULL,
	"text" text NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);
--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_owner_id_people_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_created_by_people_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_transcript_entry_id_transcript_entries_id_fk" FOREIGN KEY ("transcript_entry_id") REFERENCES "public"."transcript_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_created_by_people_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_host_id_people_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_entries" ADD CONSTRAINT "transcript_entries_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_entries" ADD CONSTRAINT "transcript_entries_speaker_id_people_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_meeting_idx" ON "action_items" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "action_items_open_idx" ON "action_items" USING btree ("completed","due_date");--> statement-breakpoint
CREATE INDEX "calendar_events_starts_idx" ON "calendar_events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "clips_meeting_idx" ON "clips" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "highlights_meeting_idx" ON "highlights" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "highlights_created_idx" ON "highlights" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "participants_person_idx" ON "meeting_participants" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "meetings_starts_at_idx" ON "meetings" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "meetings_search_idx" ON "meetings" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "transcript_meeting_idx" ON "transcript_entries" USING btree ("meeting_id","position");--> statement-breakpoint
CREATE INDEX "transcript_search_idx" ON "transcript_entries" USING gin ("search_vector");