import Link from "next/link";
import { DashSidebar } from "@/components/dash-sidebar";
import { NewEstimateWizard } from "@/components/new-estimate-wizard";

export const dynamic = "force-dynamic";

export default function NewEstimatePage() {
  return (
    <div className="dash">
      <DashSidebar active="bids" />
      <main className="dash-main">
        <div className="dash-top">
          <div>
            <h1>New estimate</h1>
            <p className="dash-sub">Upload a plan set — AI fills the details and prepares the estimate.</p>
          </div>
          <Link href="/" className="btn">Cancel</Link>
        </div>
        <NewEstimateWizard />
      </main>
    </div>
  );
}
