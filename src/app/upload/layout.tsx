export const maxDuration = 60; // Vercel 최대치(60초) 연장

export default function UploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
