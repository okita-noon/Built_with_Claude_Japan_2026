"use client";
import { useEffect, useRef } from "react";
import maplibregl, { type Map as MLMap, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Props = {
  geo: GeoJSON.FeatureCollection;
  activeId: string | null;
  verdictOf: (id: string) => "refuse" | "risk" | "wait" | "ok" | "unknown";
  onSelect: (id: string) => void;
};

const LANE_COLOR: Record<string, string> = {
  refuse: "#8a3a30",
  risk: "#b7892a",
  wait: "#6b5d50",
  ok: "#5e7a3e",
  unknown: "#b8a893",
};

const STYLE: StyleSpecification = {
  version: 8,
  // 和紙の下地に地理院のシームレス空中写真を少し褪せさせて重ねる。
  // 筆ポリゴンは架空データ（位置をずらしたダミー）で、実在の筆とは対応しない。
  sources: {
    photo: {
      type: "raster",
      tiles: ["https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"],
      tileSize: 256,
      maxzoom: 18,
      attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#efe6d2" } },
    {
      id: "photo",
      type: "raster",
      source: "photo",
      paint: { "raster-saturation": -0.45, "raster-contrast": -0.1, "raster-opacity": 0.85, "raster-fade-duration": 300 },
    },
  ],
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
};

function withLane(geo: GeoJSON.FeatureCollection, verdictOf: Props["verdictOf"]): GeoJSON.FeatureCollection {
  return {
    ...geo,
    features: geo.features.map((f) => ({
      ...f,
      properties: { ...f.properties, lane: verdictOf(String(f.properties?.id)) },
    })),
  };
}

export function MapView({ geo, activeId, verdictOf, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  // load 前に来た props を load 時に反映するため、最新値を持っておく
  const latest = useRef({ geo, activeId, verdictOf, onSelect });
  latest.current = { geo, activeId, verdictOf, onSelect };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [135.5008, 33.95005],
      zoom: 15.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on("load", () => {
      const init = latest.current;
      map.addSource("fude", { type: "geojson", data: withLane(init.geo, init.verdictOf) });

      map.addLayer({
        id: "fude-fill",
        type: "fill",
        source: "fude",
        paint: {
          "fill-color": [
            "match",
            ["get", "lane"],
            "refuse", LANE_COLOR.refuse,
            "risk", LANE_COLOR.risk,
            "wait", LANE_COLOR.wait,
            "ok", LANE_COLOR.ok,
            LANE_COLOR.unknown,
          ],
          "fill-opacity": [
            "case",
            ["==", ["get", "id"], init.activeId ?? ""],
            0.78,
            0.42,
          ],
        },
      });

      map.addLayer({
        id: "fude-stroke",
        type: "line",
        source: "fude",
        paint: {
          "line-color": "#1a1612",
          "line-width": [
            "case",
            ["==", ["get", "id"], init.activeId ?? ""],
            2.4,
            1.0,
          ],
          "line-opacity": 0.9,
        },
      });

      // ラベルは筆フォントが読み込めないので最低限は書体標準で、位置の意味だけで持つ
      map.on("click", "fude-fill", (e) => {
        const f = e.features?.[0];
        if (f?.properties?.id) latest.current.onSelect(String(f.properties.id));
      });
      map.on("mouseenter", "fude-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "fude-fill", () => (map.getCanvas().style.cursor = ""));
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // データ・ハイライト更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("fude") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    src.setData(withLane(geo, verdictOf));
    map.setPaintProperty("fude-fill", "fill-opacity", ["case", ["==", ["get", "id"], activeId ?? ""], 0.78, 0.42]);
    map.setPaintProperty("fude-stroke", "line-width", ["case", ["==", ["get", "id"], activeId ?? ""], 2.4, 1.0]);
  }, [geo, activeId, verdictOf]);

  return <div ref={containerRef} className="w-full h-full rounded-md stroke-edge overflow-hidden" />;
}
