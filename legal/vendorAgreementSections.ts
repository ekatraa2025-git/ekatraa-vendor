export const VENDOR_TERMS_VERSION = '2025-03-24-v1';

export const VENDOR_EFFECTIVE_DATE_LABEL = 'March 24, 2025';

export const VENDOR_AGREEMENT_SECTIONS: string[] = [
    `Vendor Terms & Conditions
Ekatraa Assistance Private Limited
Effective Date: ${VENDOR_EFFECTIVE_DATE_LABEL}

These Vendor Terms & Conditions ("Terms") constitute a legally binding agreement between Ekatraa Assistance Private Limited ("Ekatraa") AND You, the registering Vendor ("You").
By clicking "I Agree" / "Accept & Continue", you acknowledge that you have read and understood these Terms, agree to be legally bound by them, and confirm that you have the authority to enter into this Agreement.`,

    `1. PLATFORM ROLE
1.1 Ekatraa is not an event management company and does not provide or execute any services listed on the Platform.
1.2 Ekatraa operates solely as a technology intermediary facilitating connections between Users and Vendors.
1.3 Ekatraa does not control service delivery, guarantee bookings or outcomes, or assume responsibility for Vendor services.`,

    `2. INDEPENDENT CONTRACTOR STATUS
2.1 You agree that you are an independent contractor.
2.2 Nothing in these Terms creates agency, partnership, employment, or joint venture.
2.3 You shall not represent yourself as an employee or agent of Ekatraa.`,

    `3. VENDOR OBLIGATIONS
You agree to provide services lawfully, professionally, and safely; maintain all required licenses, registrations, and permits; and ensure accuracy of business details, pricing, and service descriptions.`,

    `4. LEGAL & REGULATORY COMPLIANCE
4.1 You shall comply with all applicable laws, including Indian Contract Act, 1872; Consumer Protection Act, 2019; Information Technology Act, 2000; GST and tax laws; local licensing laws.
4.2 For alcohol-related services (if applicable), you shall hold valid license under Odisha Excise Act, 2008, ensure compliance with excise rules, and not provide services unlawfully.
4.3 You are solely responsible for legal compliance.`,

    `5. BOOKINGS & SERVICE DELIVERY
5.1 All bookings received via Ekatraa shall be honoured.
5.2 You are solely responsible for service execution, timelines, and customer satisfaction.
5.3 Ekatraa shall not be liable for service failures, customer complaints, or operational issues.`,

    `6. PAYMENT TERMS
6.1 Ekatraa may facilitate payment collection.
6.2 Payouts to Vendors shall be subject to platform fees/commission (10% of the invoice value) and settlement timelines (5% advance, 35% 7 days before starting the service, balance 50% after service completion).
6.3 Ekatraa is not responsible for offline payments or User defaults.`,

    `7. CANCELLATION & REFUND COMPLIANCE
7.1 You agree to comply with Ekatraa Booking Protection Policy and platform refund rules.
7.2 You shall honour refunds and rescheduling commitments as per platform policies.`,

    `8. INDEMNITY
You agree to indemnify, defend, and hold harmless Ekatraa, its directors, employees, and affiliates from any claims arising from service defects or failure, personal injury or property damage, legal violations (including excise violations), customer disputes, misrepresentation or negligence. This obligation survives termination.`,

    `9. LIMITATION OF LIABILITY
To the maximum extent permitted by law, Ekatraa shall not be liable for any direct or indirect losses, service-related damages, or legal or regulatory penalties. Ekatraa's liability shall be limited to platform commission fees earned from the Vendor for that transaction.`,

    `10. DATA PROTECTION
10.1 You shall use customer data only for service delivery and not store, misuse, or share data.
10.2 You shall comply with Information Technology Act, 2000 and Digital Personal Data Protection Act, 2023.`,

    `11. SUSPENSION & TERMINATION
Ekatraa may suspend or terminate your account for legal violations, customer complaints, or policy breaches. Immediate suspension may occur without prior notice.`,

    `12. FORCE MAJEURE
Ekatraa shall not be liable for delays or failures due to government restrictions, natural disasters, or emergencies.`,

    `13. GOVERNING LAW & JURISDICTION
Laws of India. Courts located in Odisha.`,

    `VENDOR PRIVACY POLICY
1. INTRODUCTION — Governs collection, processing, storage, and sharing of Vendor data. Complies with IT Act, 2000; IT Rules, 2011; DPDP Act, 2023.

2. DATA COLLECTED — Business & identity data; contact details; financial data (bank, settlement); technical data (IP, device, logs).

3. PURPOSE — Onboarding, verification, regulatory compliance (including excise), bookings, payments, fraud prevention, security.

4. LEGAL BASIS — Consent, contractual necessity, legal obligations.

5. DATA SHARING — Customers (limited business info), payment processors, authorities if required. Ekatraa does not sell Vendor data.

6. RETENTION — During active engagement and as required by law.

7. VENDOR RIGHTS — Access, correction, deletion (subject to law).

8. SECURITY — Encryption, access control, secure storage.

9. CONFIDENTIALITY — Do not misuse customer data.

10. CONTACT — grievance@ekatraa.in | 522/3199, Behera Sahi, Nayapalli, Bhubaneswar, Odisha - 751012.`,

    `GRIEVANCE OFFICER & DISPUTE RESOLUTION (VENDOR)
Grievance Officer: Debasis Rath | grievance@ekatraa.in | Address as above.
Vendor grievances: payments, platform issues, customer disputes.
Acknowledgement: 24–48 hours; resolution: 15 days (vendor process).
Disputes: amicable resolution first; then Odisha jurisdiction, laws of India.
Platform role: facilitator; final liability per case; Ekatraa policy decision final for platform purposes.`,

    `REFUND DISPUTE HANDLING SOP (VENDOR)
Vendor agrees to honour bookings, follow refund/rescheduling policies, respond within timelines.
Flow: User complaint (48h) → Ekatraa review → Vendor notification (48h response; failure may mean decision without vendor input) → decision criteria → outcome (full/partial/no refund) — Vendor complies.
Financial: refunds may be adjusted from payouts or recovered from vendor account.
Escalation: Grievance Officer within 15 days.
Vendor agrees Ekatraa is not liable for service disputes/refund claims; Vendor bears responsibility for delivery and compliance.`,

    `MODIFICATION OF TERMS
Ekatraa may update these Terms at any time. Continued use constitutes acceptance.

ELECTRONIC ACCEPTANCE
Clicking "Accept" constitutes valid electronic consent under the Information Technology Act, 2000. Legally binding digital contract; electronic records admissible in court.`,
];

export function getVendorAgreementFullText(): string {
    return VENDOR_AGREEMENT_SECTIONS.join('\n\n');
}
