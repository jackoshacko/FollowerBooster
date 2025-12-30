import React from "react";

export default function Terms() {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl font-semibold">Terms of Service</h1>
      <p className="text-zinc-300">
        By using this website, you agree to these Terms. Our services are provided “as is”.
        Results may vary depending on platform conditions and external factors.
      </p>
      <p className="text-zinc-300">
        You are responsible for ensuring that your use complies with any third-party platform rules.
        We are not affiliated with Instagram, TikTok, Meta, Google, or any platform provider.
      </p>
      <p className="text-zinc-300">
        We may refuse service in cases of fraud, abuse, chargeback risk, or prohibited usage.
      </p>
      <p className="text-zinc-400 text-sm">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>
    </div>
  );
}
