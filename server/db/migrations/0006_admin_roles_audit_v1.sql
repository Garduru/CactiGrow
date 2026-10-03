CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_player_id" uuid NOT NULL,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"target_player_id" uuid,
	"reason" text NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"command_id" uuid NOT NULL,
	"request_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_log_actor_command_unique" UNIQUE("actor_player_id","command_id"),
	CONSTRAINT "admin_audit_log_reason_valid" CHECK (length(btrim("admin_audit_log"."reason")) BETWEEN 3 AND 240),
	CONSTRAINT "admin_audit_log_actor_role_valid" CHECK ("admin_audit_log"."actor_role" IN ('MODERATOR','ADMIN','OWNER'))
);
--> statement-breakpoint
CREATE TABLE "admin_role_assignments" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"assigned_by_player_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_role_assignments_role_valid" CHECK ("admin_role_assignments"."role" IN ('MODERATOR','ADMIN','OWNER'))
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_player_id_players_id_fk" FOREIGN KEY ("actor_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_target_player_id_players_id_fk" FOREIGN KEY ("target_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_role_assignments" ADD CONSTRAINT "admin_role_assignments_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_role_assignments" ADD CONSTRAINT "admin_role_assignments_assigned_by_player_id_players_id_fk" FOREIGN KEY ("assigned_by_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_log_recent_idx" ON "admin_audit_log" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_idx" ON "admin_audit_log" USING btree ("target_player_id","created_at");