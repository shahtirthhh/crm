import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">That record does not exist or has been removed.</p>
      <Button asChild className="mt-6">
        <Link href="/">Back to Today</Link>
      </Button>
    </div>
  );
}
