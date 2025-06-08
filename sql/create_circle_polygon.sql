-- Insert a circular polygon with a 1 km radius around a center point.
-- Replace the lat, lon and name values or pass them as psql variables.
INSERT INTO polygon_areas(name, geom)
VALUES (
  COALESCE(:'name', 'Circle 1km'),
  ST_Buffer(
    ST_SetSRID(ST_MakePoint(:'lon', :'lat'), 4326)::geography,
    1000
  )::geometry
);
