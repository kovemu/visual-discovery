export default function PrivacyPolicyContent() {
  return (
    <div className="space-y-10 text-base leading-8 text-gray-600">
      <section>
        <h2 className="text-xl font-bold text-gray-950">
          Information We Collect
        </h2>
        <p className="mt-3">
          Kovemu collects only the information needed to operate the service
          during this MVP phase:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>Email address</li>
          <li>Authentication and account information</li>
          <li>
            User interactions such as Picks and Votes, where applicable
          </li>
          <li>
            Basic product analytics such as anonymous session identifiers and
            event names (for example, when you view a Discover set or open an
            artist profile)
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-950">
          How We Use Information
        </h2>
        <p className="mt-3">
          We use this information to authenticate users, save preferences and
          Picks, operate Kovemu, and improve the product experience.
        </p>
      </section>

      <section>
  <h2 className="text-xl font-bold text-gray-950">
    Analytics and Local Storage
  </h2>

  <p className="mt-3">
    Kovemu may store a randomly generated anonymous session identifier in
    your browser&apos;s local storage to understand how the service is used
    and improve the product experience. This identifier does not contain
    your email address or other directly identifying information.
  </p>
</section>

      <section>
        <h2 className="text-xl font-bold text-gray-950">
          Service Providers
        </h2>
        <p className="mt-3">
          Kovemu uses trusted infrastructure providers to run the service,
          including:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>Supabase for authentication, database, and storage</li>
          <li>Vercel for hosting and deployment</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-950">
          Data Retention and Deletion
        </h2>
        <p className="mt-3">
          We retain account and interaction data while your account is active
          and as needed to operate the service. You may request account-related
          data deletion by contacting us.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-950">
          User Rights
        </h2>
        <p className="mt-3">
          Depending on your location, you may have rights to access, correct, or
          delete personal information we hold about you. Contact us to make a
          request.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-950">
          Security
        </h2>
        <p className="mt-3">
          We use reasonable technical and organizational measures to protect
          user information. No online service can guarantee absolute security.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-950">
          Changes to This Policy
        </h2>
        <p className="mt-3">
          We may update this Privacy Policy from time to time. When we do, we
          will revise the effective date on this page.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-950">
          Contact
        </h2>
        <p className="mt-3">
          Questions about this Privacy Policy can be sent to{" "}
          <a
            href="mailto:kovemusin@gmail.com"
            className="font-semibold text-fuchsia-600 transition hover:text-fuchsia-700"
          >
            kovemusin@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
