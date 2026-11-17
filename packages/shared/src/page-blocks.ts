/**
 * Editable text blocks for pages whose layout is fixed in code.
 * The admin ("Pages & SEO") shows one input per block (the default is the placeholder);
 * the website reads `payload.blocks[key]` and falls back to `default` when it is empty.
 */
export type BlockType = "text" | "textarea" | "image" | "url" | "color" | "font" | "number";
export type PageBlock = {
  key: string;
  label: string;
  default: string;
  multiline?: boolean;
  /** inferred from the key when omitted: *Image → image, *Url → url, color* → color, font* → font */
  type?: BlockType;
  group?: string;
};

const baseBlocks: Record<string, PageBlock[]> = {
  privacy: [
    { key: "s1Title", label: "Section 1 — title", default: "What this website is" },
    {
      key: "s1Text",
      label: "Section 1 — text",
      multiline: true,
      default:
        "This website is a central information portal for separately organized, family-owned real-estate entities in South San Francisco. Individual properties are owned by their respective legal entities, as identified on each property page.",
    },
    { key: "s2Title", label: "Section 2 — title", default: "Information we collect" },
    {
      key: "s2Text",
      label: "Section 2 — text",
      multiline: true,
      default:
        "When you send an inquiry through the contact form we collect the name, email address, inquiry type, optional property and message you enter. We do not ask for payment card, bank account or other sensitive financial information, and ask that you do not include any in your message.",
    },
    { key: "s3Title", label: "Section 3 — title", default: "How we use it" },
    {
      key: "s3Text",
      label: "Section 3 — text",
      multiline: true,
      default:
        "We use inquiry information only to respond to your question and to route it to the right team at Buzz Haskins Equipment Co., Inc., the property management company. Inquiries are stored in the website’s database and are visible to authorized management staff.",
    },
    { key: "s4Title", label: "Section 4 — title", default: "Cookies and analytics" },
    {
      key: "s4Text",
      label: "Section 4 — text",
      multiline: true,
      default:
        "This website does not set advertising or tracking cookies. If analytics are switched on in the future, they will load only after you give consent, and you can change your choice at any time using “Cookie settings”.",
    },
    { key: "s5Title", label: "Section 5 — title", default: "Sharing and retention" },
    {
      key: "s5Text",
      label: "Section 5 — text",
      multiline: true,
      default:
        "We do not sell personal information. Inquiry information is not shared outside the management team except with service providers that help operate the website, or where required by law. The retention period for inquiries is pending confirmation by the owner.",
    },
    { key: "s6Title", label: "Section 6 — title", default: "Your choices and contact" },
    {
      key: "s6Text",
      label: "Section 6 — text",
      multiline: true,
      default:
        "You may ask us to access, correct or delete the information you sent us by contacting property management. This is a draft: the final policy, including any notices and rights required under California law, is pending owner approval and legal review.",
    },
  ],
  history: [
    {
      key: "foundationLead",
      label: "Our foundation — lead paragraph",
      multiline: true,
      default:
        "The original yard, equipment and people tell the story of a hands-on business and its connection to South San Francisco. The family archive preserves that industrial heritage.",
    },
    {
      key: "foundationBody",
      label: "Our foundation — second paragraph",
      multiline: true,
      default:
        "Today, the family’s focus is the stewardship of real estate held across separate legal entities, with property administration provided by Buzz Haskins Equipment Co., Inc.",
    },
    { key: "archive1Caption", label: "Archive photo 1 — caption", default: "A hands-on legacy" },
    { key: "archive2Caption", label: "Archive photo 2 — caption", default: "Equipment that shaped the story" },
    { key: "archive3Caption", label: "Archive photo 3 — caption", default: "Preserved in the family archive" },
  ],
  services: [
    {
      key: "bannerText",
      label: "Intro banner paragraph",
      multiline: true,
      default:
        "Built through firsthand administration of our family’s real-estate portfolio, our approach brings organization, consistency and meaningful cost efficiencies to privately held property.",
    },
    { key: "s1Title", label: "Service 1 — title", default: "Accounting & financial administration" },
    {
      key: "s1Text",
      label: "Service 1 — description",
      multiline: true,
      default:
        "QuickBooks Enterprise configuration, class-based reporting, expense tracking, reconciliations and organized records.",
    },
    { key: "s2Title", label: "Service 2 — title", default: "Tenant administration" },
    {
      key: "s2Text",
      label: "Service 2 — description",
      multiline: true,
      default:
        "Routine correspondence, notices, tenant records and streamlined service-request communications.",
    },
    { key: "s3Title", label: "Service 3 — title", default: "Maintenance & property care" },
    {
      key: "s3Text",
      label: "Service 3 — description",
      multiline: true,
      default:
        "Basic cleaning, routine upkeep, preventative maintenance coordination and property oversight.",
    },
    { key: "s4Title", label: "Service 4 — title", default: "Vendor & repair coordination" },
    {
      key: "s4Text",
      label: "Service 4 — description",
      multiline: true,
      default:
        "Scheduling qualified contractors, organizing estimates and invoices, and monitoring recurring expenses.",
    },
    { key: "s5Title", label: "Service 5 — title", default: "Operational efficiency" },
    {
      key: "s5Text",
      label: "Service 5 — description",
      multiline: true,
      default:
        "Practical workflows, less repetitive administration, improved reporting and cost-conscious operations.",
    },
    {
      key: "scopeText",
      label: "Scope of services statement (legal wording — change only with owner approval)",
      multiline: true,
      default:
        "BHE provides administrative, accounting-support, maintenance and operational coordination services only. Brokerage, leasing, tenant procurement, lease or contract negotiation, execution of agreements and activities requiring a California real estate license are excluded. BHE is not a licensed contractor and does not perform for-hire contracting work.",
    },
  ],
};

import { designBlocks, homeBlocks, layoutBlocks } from "./site-blocks";

export const pageBlocks: Record<string, PageBlock[]> = {
  ...baseBlocks,
  home: homeBlocks,
  layout: layoutBlocks,
  design: designBlocks,
};
