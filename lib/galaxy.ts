import Graph from "graphology";
import data from "../data/galaxy.json";
type ToolNode = (typeof data.nodes)[number];
export type GalaxyFilter = {
  server?: string;
  risk?: string;
  query?: string;
  nearDup?: boolean;
};
/** Same catalog, public coordinates and Sigma rendering family as the reference. */
export async function mountGalaxy(
  container: HTMLElement,
  onSelect: (n: ToolNode) => void,
) {
  const { default: Sigma } = await import("sigma");
  const graph = new Graph({ type: "directed", multi: false });
  const colors = [
    "#FFE66D",
    "#9DB08A",
    "#FFC8DD",
    "#BDE0FE",
    "#BDE0FE",
    "#BDE0FE",
    "#FFE66D",
    "#9DB08A",
    "#FFE66D",
    "#FFE66D",
    "#9DB08A",
    "#BDE0FE",
    "#FFC8DD",
    "#9DB08A",
    "#FFE66D",
    "#BDE0FE",
    "#BDE0FE",
    "#BDE0FE",
    "#FFE66D",
    "#BDE0FE",
  ];
  const servers = data.servers.map((s) => s.id);
  const maxDegree = Math.max(
    ...data.nodes.filter((n) => n.kind === "tool").map((n) => n.degree),
  );
  for (const n of data.nodes)
    graph.addNode(n.id, {
      x: n.x,
      y: n.y,
      size:
        n.kind === "server"
          ? 9 + 1.3 * Math.sqrt(n.degree)
          : n.kind === "type"
            ? 3 + 0.9 * Math.sqrt(n.degree)
            : 2 + (n.degree / maxDegree) * 4,
      label: n.label,
      color:
        n.kind === "type"
          ? "#9DB08A"
          : colors[servers.indexOf(n.server || "")] || "#BDE0FE",
      kind: n.kind,
      server: n.server,
      risk: "risk" in n ? n.risk : [],
      raw: n,
    });
  for (const [source, target, kind] of data.edges)
    if (
      graph.hasNode(source) &&
      graph.hasNode(target) &&
      !graph.hasEdge(source, target)
    )
      graph.addEdge(source, target, {
        kind,
        color: kind === "HAS" ? "rgba(157,176,138,.10)" : "rgba(78,107,58,.22)",
        size: kind === "HAS" ? 0.4 : 0.6,
      });
  for (const [source, target] of data.nearDup)
    if (
      graph.hasNode(source) &&
      graph.hasNode(target) &&
      !graph.hasEdge(source, target) &&
      !graph.hasEdge(target, source)
    )
      graph.addEdge(source, target, {
        kind: "NEAR_DUP",
        color: "#FF5A36",
        size: 1.6,
        hidden: true,
      });
  let filters: GalaxyFilter = {},
    hover: string | null = null,
    selected: string | null = null;
  const sigma = new Sigma(graph, container, {
    renderEdgeLabels: false,
    zIndex: true,
    allowInvalidContainer: true,
    defaultEdgeType: "line",
    labelFont: "monospace",
    labelColor: { color: "#F6F1E4" },
    labelSize: 11,
    labelWeight: "400",
    labelRenderedSizeThreshold: 9,
    labelDensity: 0.6,
    minCameraRatio: 0.05,
    maxCameraRatio: 2.5,
    nodeReducer(key, attributes) {
      const node = { ...attributes };
      const active = hover || selected;
      const faded = !!(
        (filters.risk &&
          (attributes.kind !== "tool" ||
            !attributes.risk.includes(filters.risk))) ||
        (filters.server &&
          attributes.server !== filters.server &&
          attributes.kind !== "type") ||
        (filters.query &&
          filters.query.length > 1 &&
          !attributes.label
            .toLowerCase()
            .includes(filters.query.toLowerCase())) ||
        (filters.nearDup &&
          attributes.kind === "tool" &&
          !graph
            .edges(key)
            .some(
              (edge) => graph.getEdgeAttribute(edge, "kind") === "NEAR_DUP",
            )) ||
        (active && key !== active && !graph.areNeighbors(active, key))
      );
      if (faded) {
        node.color = "rgba(157,176,138,.16)";
        node.label = "";
        node.zIndex = 0;
      } else if (active) {
        node.zIndex = 2;
        node.forceLabel = true;
        if (key !== active && attributes.kind === "type")
          node.color = "#D9F94A";
      }
      if (attributes.kind === "server" && !faded) node.forceLabel = true;
      return node;
    },
    edgeReducer(key, attributes) {
      const edge = { ...attributes };
      const [source, target] = graph.extremities(key);
      if (attributes.kind === "NEAR_DUP") {
        edge.hidden = !filters.nearDup;
        return edge;
      }
      const active = hover || selected;
      if (active) {
        if (source === active || target === active) {
          edge.color = "#D9F94A";
          edge.size = 1.6;
        } else edge.hidden = true;
      } else if (
        filters.server &&
        graph.getNodeAttribute(source, "server") !== filters.server &&
        graph.getNodeAttribute(target, "server") !== filters.server
      )
        edge.hidden = true;
      if (filters.risk) edge.hidden = true;
      return edge;
    },
  });
  sigma.on("enterNode", ({ node }) => {
    hover = node;
    container.style.cursor = "pointer";
    sigma.refresh();
  });
  sigma.on("leaveNode", () => {
    hover = null;
    container.style.cursor = "default";
    sigma.refresh();
  });
  sigma.on("clickNode", ({ node }) => {
    selected = node;
    onSelect(graph.getNodeAttribute(node, "raw"));
    sigma.refresh();
  });
  const resize = new ResizeObserver(() => sigma.refresh());
  resize.observe(container);
  return {
    setFilter(next: GalaxyFilter) {
      filters = next;
      selected = null;
      sigma.refresh();
    },
    focusServer(id: string) {
      filters.server = id;
      selected = null;
      sigma.refresh();
      const node = graph.getNodeAttributes("s:" + id);
      const point = sigma.graphToViewport({ x: node.x, y: node.y });
      const camera = sigma.getCamera();
      const pos = sigma.viewportToFramedGraph(point);
      camera.animate({ x: pos.x, y: pos.y, ratio: 0.48 }, { duration: 700 });
    },
    destroy() {
      resize.disconnect();
      sigma.kill();
    },
    sigma,
    graph,
  };
}
