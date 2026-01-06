CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tvg_id" text,
	"tvg_name" text NOT NULL,
	"tvg_logo" text,
	"group_title" text,
	"stream_url" text,
	"content_id" integer,
	"name" text,
	"country_code" text,
	"favourite" boolean DEFAULT false,
	"active" boolean DEFAULT false,
	"script_alias" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
