drop trigger if exists "set_updated_at_content_blog_post_comments" on "public"."content_blog_post_comments";

drop trigger if exists "set_updated_at_content_blog_posts" on "public"."content_blog_posts";

drop trigger if exists "set_owner_id_on_insert" on "public"."private_items";

drop policy "content_blog_post_comments_delete_policy" on "public"."content_blog_post_comments";

drop policy "content_blog_post_comments_insert_policy" on "public"."content_blog_post_comments";

drop policy "content_blog_post_comments_select_policy" on "public"."content_blog_post_comments";

drop policy "content_blog_post_comments_update_policy" on "public"."content_blog_post_comments";

drop policy "content_blog_posts_delete_policy" on "public"."content_blog_posts";

drop policy "content_blog_posts_insert_policy" on "public"."content_blog_posts";

drop policy "content_blog_posts_select_policy" on "public"."content_blog_posts";

drop policy "content_blog_posts_update_policy" on "public"."content_blog_posts";

drop policy "delete_own_policy" on "public"."private_items";

drop policy "insert_auth_policy" on "public"."private_items";

drop policy "select_all_policy" on "public"."private_items";

drop policy "update_own_policy" on "public"."private_items";

revoke delete on table "public"."content_blog_post_comments" from "anon";

revoke insert on table "public"."content_blog_post_comments" from "anon";

revoke references on table "public"."content_blog_post_comments" from "anon";

revoke select on table "public"."content_blog_post_comments" from "anon";

revoke trigger on table "public"."content_blog_post_comments" from "anon";

revoke truncate on table "public"."content_blog_post_comments" from "anon";

revoke update on table "public"."content_blog_post_comments" from "anon";

revoke delete on table "public"."content_blog_post_comments" from "authenticated";

revoke insert on table "public"."content_blog_post_comments" from "authenticated";

revoke references on table "public"."content_blog_post_comments" from "authenticated";

revoke select on table "public"."content_blog_post_comments" from "authenticated";

revoke trigger on table "public"."content_blog_post_comments" from "authenticated";

revoke truncate on table "public"."content_blog_post_comments" from "authenticated";

revoke update on table "public"."content_blog_post_comments" from "authenticated";

revoke delete on table "public"."content_blog_post_comments" from "service_role";

revoke insert on table "public"."content_blog_post_comments" from "service_role";

revoke references on table "public"."content_blog_post_comments" from "service_role";

revoke select on table "public"."content_blog_post_comments" from "service_role";

revoke trigger on table "public"."content_blog_post_comments" from "service_role";

revoke truncate on table "public"."content_blog_post_comments" from "service_role";

revoke update on table "public"."content_blog_post_comments" from "service_role";

revoke delete on table "public"."content_blog_posts" from "anon";

revoke insert on table "public"."content_blog_posts" from "anon";

revoke references on table "public"."content_blog_posts" from "anon";

revoke select on table "public"."content_blog_posts" from "anon";

revoke trigger on table "public"."content_blog_posts" from "anon";

revoke truncate on table "public"."content_blog_posts" from "anon";

revoke update on table "public"."content_blog_posts" from "anon";

revoke delete on table "public"."content_blog_posts" from "authenticated";

revoke insert on table "public"."content_blog_posts" from "authenticated";

revoke references on table "public"."content_blog_posts" from "authenticated";

revoke select on table "public"."content_blog_posts" from "authenticated";

revoke trigger on table "public"."content_blog_posts" from "authenticated";

revoke truncate on table "public"."content_blog_posts" from "authenticated";

revoke update on table "public"."content_blog_posts" from "authenticated";

revoke delete on table "public"."content_blog_posts" from "service_role";

revoke insert on table "public"."content_blog_posts" from "service_role";

revoke references on table "public"."content_blog_posts" from "service_role";

revoke select on table "public"."content_blog_posts" from "service_role";

revoke trigger on table "public"."content_blog_posts" from "service_role";

revoke truncate on table "public"."content_blog_posts" from "service_role";

revoke update on table "public"."content_blog_posts" from "service_role";

revoke delete on table "public"."private_items" from "anon";

revoke insert on table "public"."private_items" from "anon";

revoke references on table "public"."private_items" from "anon";

revoke select on table "public"."private_items" from "anon";

revoke trigger on table "public"."private_items" from "anon";

revoke truncate on table "public"."private_items" from "anon";

revoke update on table "public"."private_items" from "anon";

revoke delete on table "public"."private_items" from "authenticated";

revoke insert on table "public"."private_items" from "authenticated";

revoke references on table "public"."private_items" from "authenticated";

revoke select on table "public"."private_items" from "authenticated";

revoke trigger on table "public"."private_items" from "authenticated";

revoke truncate on table "public"."private_items" from "authenticated";

revoke update on table "public"."private_items" from "authenticated";

revoke delete on table "public"."private_items" from "service_role";

revoke insert on table "public"."private_items" from "service_role";

revoke references on table "public"."private_items" from "service_role";

revoke select on table "public"."private_items" from "service_role";

revoke trigger on table "public"."private_items" from "service_role";

revoke truncate on table "public"."private_items" from "service_role";

revoke update on table "public"."private_items" from "service_role";

alter table "public"."content_blog_post_comments" drop constraint "content_blog_post_comments_author_id_fkey";

alter table "public"."content_blog_post_comments" drop constraint "content_blog_post_comments_blog_post_id_fkey";

alter table "public"."content_blog_posts" drop constraint "content_blog_posts_author_id_fkey";

alter table "public"."private_items" drop constraint "private_items_owner_id_fkey";

drop function if exists "public"."set_private_item_owner_id"();

alter table "public"."content_blog_post_comments" drop constraint "content_blog_post_comments_pkey";

alter table "public"."content_blog_posts" drop constraint "content_blog_posts_pkey";

alter table "public"."private_items" drop constraint "private_items_pkey";

drop index if exists "public"."content_blog_post_comments_author_id_idx";

drop index if exists "public"."content_blog_post_comments_pkey";

drop index if exists "public"."content_blog_post_comments_post_id_idx";

drop index if exists "public"."content_blog_posts_author_id_idx";

drop index if exists "public"."content_blog_posts_pkey";

drop index if exists "public"."content_blog_posts_published_at_idx";

drop index if exists "public"."content_blog_posts_slug_key";

drop index if exists "public"."idx_private_items_created_at";

drop index if exists "public"."idx_private_items_id_created_at";

drop index if exists "public"."idx_private_items_owner_id";

drop index if exists "public"."private_items_pkey";

drop table "public"."content_blog_post_comments";

drop table "public"."content_blog_posts";

drop table "public"."private_items";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$function$
;


