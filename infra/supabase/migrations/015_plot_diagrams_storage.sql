-- ClearDeed — Plot Diagram SVG Storage
-- Migration: 015_plot_diagrams_storage
-- Created: 2026-06-19
-- Phase 8 (Task 34) of the unified insight engine.
-- Stores WFS-composed plot diagram SVGs (from packages/render/plot-diagram-svg.ts)
-- as public storage objects keyed by report id + diagram key.

-- Create storage bucket for plot diagram SVGs.
-- Public so the consumer report can embed the URL directly without
-- generating short-lived signed URLs at read time.
INSERT INTO storage.buckets (id, name, public)
VALUES ('plot-diagrams', 'plot-diagrams', true)
ON CONFLICT (id) DO NOTHING;
