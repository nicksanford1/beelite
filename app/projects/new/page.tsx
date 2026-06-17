import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { createProject } from "@/app/actions";

export default function NewProjectPage() {
  return (
    <main className="wrap">
      <SiteHeader />

      <div className="section-label">
        <span className="eyebrow">New bid</span>
      </div>

      <form action={createProject} className="form">
        <div className="field">
          <label htmlFor="name">
            Project name <span className="req">*</span>
          </label>
          <input
            id="name"
            name="name"
            required
            autoFocus
            placeholder="Westside Medical — Tenant Improvement"
          />
        </div>

        <div className="field">
          <label htmlFor="gc">General contractor</label>
          <input id="gc" name="gc" placeholder="Turner Construction" />
        </div>

        <div className="field">
          <label htmlFor="location">Building / location</label>
          <input id="location" name="location" placeholder="Phoenix, AZ" />
        </div>

        <div className="field">
          <label htmlFor="bidDate">Bid date</label>
          <input id="bidDate" name="bidDate" type="date" />
        </div>

        <div className="field">
          <label htmlFor="notes">Notes / exclusions</label>
          <textarea
            id="notes"
            name="notes"
            placeholder="Moisture mitigation excluded unless noted…"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Create bid
          </button>
          <Link href="/" className="btn">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
