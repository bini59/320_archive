export function activeNavId(pathname: string): string {
  if (pathname === "/") return "register";
  if (pathname === "/archives" || pathname.startsWith("/archives/")) return "archives";
  if (pathname === "/settings") return "settings";
  const folder = /^\/library\/([^/]+)/.exec(pathname);
  return folder ? `folder:${folder[1]}` : "library";
}
