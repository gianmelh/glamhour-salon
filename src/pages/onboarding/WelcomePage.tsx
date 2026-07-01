import { Link } from "react-router-dom";
import salonIllustration from "../../assets/salon-illustration.png";

function StatusBar() {
  return <div className="h-11" />;
}

export function WelcomePage() {
  return (
    <main className="flex min-h-dvh flex-col overflow-hidden bg-[linear-gradient(180deg,#fffafb_0%,#f5efff_42%,#a775ff_100%)]">
      <StatusBar />

      <section className="flex flex-1 flex-col">
        <div className="px-4 pt-3">
          <h1 className="max-w-[350px] text-[26px] font-bold leading-[1.1] text-black">
            A salon app that
            <br />
            adapts to you.
          </h1>
          <p className="mt-5 max-w-[340px] text-[16px] font-bold leading-[1.22] text-black">
            Personalize services, schedules,
            <br />
            and client data in one place.
          </p>
        </div>

        <div className="mt-[13vh] flex items-end max-[360px]:mt-9">
          <img
            alt=""
            className="h-auto w-[385px] max-w-none translate-x-[6px] object-contain"
            draggable={false}
            src={salonIllustration}
          />
        </div>

        <div className="mt-auto grid gap-3 px-4 pb-6 pt-9">
          <Link
            className="flex h-[45px] items-center justify-center rounded-[10px] bg-[linear-gradient(180deg,#8044df_0%,#4d208d_100%)] text-[14px] font-normal text-white shadow-[0_9px_14px_rgb(53_26_112_/_0.42)]"
            to="/login"
          >
            Log in
          </Link>
          <Link
            className="flex h-[45px] items-center justify-center rounded-[10px] bg-[#f8f9ff] text-[14px] font-normal text-[#7b35e2] shadow-[0_8px_13px_rgb(78_52_139_/_0.22)]"
            to="/signup"
          >
            Sign up
          </Link>
        </div>
      </section>
    </main>
  );
}
