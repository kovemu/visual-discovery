import { createSubjectLandingRoute } from "@/lib/seo/subjectLandingRoute";

export const dynamic = "force-dynamic";

const landing = createSubjectLandingRoute("kpop", "ko");

export const generateMetadata = landing.generateMetadata;
export default landing.Page;
