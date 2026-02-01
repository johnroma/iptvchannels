CREATE TABLE "group_titles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"alias" text,
	CONSTRAINT "group_titles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvg_id" text,
	"tvg_name" text NOT NULL,
	"tvg_logo" text,
	"group_title_id" integer,
	"stream_url" text,
	"series_id" uuid,
	"media_type" text,
	"year" integer,
	"season" integer,
	"episode" integer,
	"name" text,
	"favourite" boolean DEFAULT false,
	"active" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvg_id" text,
	"tvg_name" text NOT NULL,
	"tvg_logo" text,
	"group_title_id" integer,
	"episode_count" integer DEFAULT 0 NOT NULL,
	"name" text,
	"favourite" boolean DEFAULT false,
	"active" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "group_title_id" integer;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_group_title_id_group_titles_id_fk" FOREIGN KEY ("group_title_id") REFERENCES "public"."group_titles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_group_title_id_group_titles_id_fk" FOREIGN KEY ("group_title_id") REFERENCES "public"."group_titles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_series_id_idx" ON "media" USING btree ("series_id");--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_group_title_id_group_titles_id_fk" FOREIGN KEY ("group_title_id") REFERENCES "public"."group_titles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" DROP COLUMN "group_title";