import { Check, ChevronLeft, FileUp, MapPin, Upload, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiClientError } from "../../lib/api";
import { attachGooglePlaceAutocomplete } from "../../lib/googleMaps";
import { glamhourApi } from "../../services/glamhour-api";
import type { RegisterSalonResult } from "../../types/api";
import {
  clearSignUpDraft,
  initialSignUpForm,
  readSignUpDraft,
  saveSignUpDraft,
  type SignUpForm,
} from "./signUpDraft";

type RegistrationErrors = {
  salonName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  acceptedTerms?: string;
  document?: string;
  location?: string;
};

type RegistrationState = {
  salonName?: string;
  email?: string;
};

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

function getAccountErrors(draft: SignUpForm) {
  const errors: RegistrationErrors = {};

  if (draft.authProvider !== "email" && draft.socialCredential) {
    if (!draft.acceptedTerms) {
      errors.acceptedTerms = "Please agree to the terms and conditions";
    }
    return errors;
  }

  if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  if (draft.password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  if (draft.confirmPassword.length < 6) {
    errors.confirmPassword = "Password must be at least 6 characters";
  } else if (draft.password !== draft.confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  if (!draft.acceptedTerms) {
    errors.acceptedTerms = "Please agree to the terms and conditions";
  }

  return errors;
}

export function RegistrationPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationAutocompleteRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as RegistrationState;

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [salonLocation, setSalonLocation] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [mapsError, setMapsError] = useState("");
  const [mapsLoading, setMapsLoading] = useState(Boolean(googleMapsApiKey));
  const [submitted, setSubmitted] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [created, setCreated] = useState(false);
  const [createdAccount, setCreatedAccount] =
    useState<RegisterSalonResult | null>(null);
  const [accountDraft, setAccountDraft] = useState<SignUpForm>(() => ({
    ...initialSignUpForm,
    ...readSignUpDraft(),
  }));
  const [salonName, setSalonName] = useState(
    () => readSignUpDraft().salonName || state.salonName || ""
  );
  const accountErrors = useMemo(
    () => (submitted ? getAccountErrors(accountDraft) : {}),
    [accountDraft, submitted]
  );
  const needsAccountDetails = Boolean(
    accountErrors.email ||
      accountErrors.password ||
      accountErrors.confirmPassword ||
      accountErrors.acceptedTerms ||
      (accountDraft.authProvider !== "email" && !accountDraft.socialCredential)
  );

  const errors = useMemo<RegistrationErrors>(() => {
    if (!submitted) {
      return {};
    }

    const nextErrors: RegistrationErrors = {};

    if (!salonName.trim()) {
      nextErrors.salonName = "Salon name is required";
    }

    Object.assign(nextErrors, accountErrors);

    if (!documentFile) {
      nextErrors.document = "Proof of ownership is required";
    }

    if (!salonLocation.trim()) {
      nextErrors.location = "Location validation is required";
    }

    return nextErrors;
  }, [
    accountErrors,
    documentFile,
    salonName,
    salonLocation,
    submitted,
  ]);

  useEffect(() => {
    const container = locationAutocompleteRef.current;
    if (!container || !googleMapsApiKey) {
      return;
    }

    let isMounted = true;
    let cleanupAutocomplete: (() => void) | undefined;

    attachGooglePlaceAutocomplete({
      apiKey: googleMapsApiKey,
      container,
      placeholder: "Search salon location...",
      onPlaceSelect: (place) => {
        if (!isMounted) {
          return;
        }

        setSalonLocation(place.formattedAddress);
        setSelectedPlaceId(place.placeId);
      },
    })
      .then((cleanup) => {
        cleanupAutocomplete = cleanup;
        if (isMounted) {
          setMapsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setMapsLoading(false);
          setMapsError(
            error instanceof Error
              ? error.message
              : "Google Maps could not load. Check the API key, billing, and allowed domains."
          );
        }
      });

    return () => {
      isMounted = false;
      cleanupAutocomplete?.();
    };
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setDocumentFile(nextFile);
  }

  function removeDocumentFile() {
    setDocumentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function updateAccountField<Field extends keyof SignUpForm>(
    field: Field,
    value: SignUpForm[Field]
  ) {
    setAccountDraft((current) => {
      const nextDraft = {
        ...current,
        authProvider: "email" as const,
        socialCredential: "",
        ownerFullName: "",
        [field]: value,
      };
      saveSignUpDraft({ ...nextDraft, salonName: salonName.trim() });
      return nextDraft;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setRegistrationError("");

    if (
      !salonName.trim() ||
      !documentFile ||
      !salonLocation.trim()
    ) {
      setRegistrationError("Please complete the highlighted fields before submitting.");
      return;
    }

    const draft = accountDraft;
    const nextDraft = {
      ...draft,
      authProvider:
        draft.authProvider !== "email" && !draft.socialCredential
          ? ("email" as const)
          : draft.authProvider,
      salonName: salonName.trim(),
    };
    saveSignUpDraft(nextDraft);

    const nextAccountErrors = getAccountErrors(nextDraft);
    if (Object.keys(nextAccountErrors).length > 0) {
      setRegistrationError("Please complete the account details before submitting verification.");
      return;
    }

    if (!nextDraft.acceptedTerms) {
      setRegistrationError(
        "Please complete the sign up form before submitting verification."
      );
      return;
    }

    if (
      nextDraft.authProvider === "email" &&
      (!nextDraft.email.trim() || !nextDraft.password)
    ) {
      setRegistrationError(
        "Please complete the sign up form before submitting verification."
      );
      return;
    }

    if (nextDraft.authProvider !== "email" && !nextDraft.socialCredential) {
      setRegistrationError(
        `Please sign up with ${providerLabel(
          nextDraft.authProvider
        )} again before submitting verification.`
      );
      return;
    }

    setIsRegistering(true);
    try {
      const verificationInput = {
        salonName: nextDraft.salonName.trim(),
        acceptedTerms: true as const,
        location: {
          formattedAddress: salonLocation.trim(),
          placeId: selectedPlaceId || undefined,
        },
        document: {
          originalFilename: documentFile.name,
          mimeType: documentFile.type || "application/octet-stream",
          size: documentFile.size,
        },
      };

      const result =
        nextDraft.authProvider === "google"
          ? await glamhourApi.registerGoogleSalon({
              ...verificationInput,
              credential: nextDraft.socialCredential,
            })
          : nextDraft.authProvider === "facebook"
          ? await glamhourApi.registerFacebookSalon({
              ...verificationInput,
              accessToken: nextDraft.socialCredential,
            })
          : nextDraft.authProvider === "apple"
          ? await glamhourApi.registerAppleSalon({
              ...verificationInput,
              identityToken: nextDraft.socialCredential,
              ownerFullName: nextDraft.ownerFullName || undefined,
            })
          : await glamhourApi.registerSalon({
              ...verificationInput,
              email: nextDraft.email.trim(),
              password: nextDraft.password,
            });

      window.sessionStorage.setItem(
        "glamhour:active-salon-id",
        result.salon.id
      );
      clearSignUpDraft();
      setCreatedAccount(result);
      setCreated(true);
    } catch (error) {
      setRegistrationError(
        error instanceof ApiClientError
          ? error.message
          : error instanceof Error
          ? error.message
          : "Registration could not be completed. Please try again."
      );
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <main className="relative min-h-dvh bg-[linear-gradient(180deg,#fffafc_0%,#f5edff_43%,#9d70ff_100%)] px-4 py-10">
      {!created && (
        <section className="mx-auto flex min-h-[calc(100dvh-80px)] w-full max-w-[320px] flex-col justify-center">
          <button
            className="mb-8 inline-flex w-fit items-center gap-2 text-[12px] text-[#242a39]"
            onClick={() => navigate("/signup")}
            type="button"
          >
            <ChevronLeft className="size-6 stroke-[1.7]" />
            Back
          </button>

          <div className="w-full rounded-xl bg-[#f7f8ff] px-5 py-8 shadow-[0_18px_42px_rgb(68_43_132_/_0.25)] ring-1 ring-white/75">
            <header className="text-center">
              <h1 className="text-[24px] font-semibold leading-tight text-[#12192d]">
                Create an account
              </h1>
              <p className="mt-1 text-[11px] text-[#7c8394]">
                {salonName.trim()
                  ? `Verify ${salonName.trim()} ownership`
                  : "Verify your salon ownership"}
              </p>
            </header>

            <form className="mt-7 space-y-4" noValidate onSubmit={handleSubmit}>
              {!accountDraft.salonName && !state.salonName && (
                <label className="block text-[11px] font-medium text-[#242a39]">
                  Salon Name
                  <input
                    aria-invalid={Boolean(errors.salonName)}
                    className={[
                      "mt-1 h-11 w-full rounded-lg border bg-white px-3 text-[12px] text-[#1b2133] outline-none transition placeholder:text-[#a5acbb]",
                      errors.salonName
                        ? "border-[#ff5964] focus:border-[#ff5964] focus:ring-3 focus:ring-[#ff5964]/10"
                        : "border-transparent focus:border-[#232735] focus:ring-3 focus:ring-[#232735]/10",
                    ].join(" ")}
                    onChange={(event) => setSalonName(event.target.value)}
                    placeholder="Enter salon name"
                    value={salonName}
                  />
                  {errors.salonName && (
                    <span className="mt-2 block text-[11px] text-[#ff3b4f]">
                      {errors.salonName}
                    </span>
                  )}
                </label>
              )}
              {needsAccountDetails && (
                <section className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-[#eef0f6]">
                  <p className="text-[11px] font-semibold text-[#242a39]">
                    Account Details
                  </p>
                  {accountDraft.authProvider !== "email" &&
                    !accountDraft.socialCredential && (
                      <p className="mt-1 text-[10px] leading-4 text-[#8b92a1]">
                        Google sign up did not finish. Continue with email to
                        submit verification.
                      </p>
                    )}
                  <div className="mt-3 space-y-3">
                    <RegistrationField
                      error={errors.email}
                      label="Email"
                      onChange={(value) => updateAccountField("email", value)}
                      placeholder="name@example.com"
                      type="email"
                      value={accountDraft.email}
                    />
                    <RegistrationField
                      error={errors.password}
                      label="Password"
                      onChange={(value) =>
                        updateAccountField("password", value)
                      }
                      placeholder="Enter your password"
                      type="password"
                      value={accountDraft.password}
                    />
                    <RegistrationField
                      error={errors.confirmPassword}
                      label="Confirm password"
                      onChange={(value) =>
                        updateAccountField("confirmPassword", value)
                      }
                      placeholder="Enter your password"
                      type="password"
                      value={accountDraft.confirmPassword}
                    />
                    <label className="flex items-start gap-2 text-[11px] leading-4 text-[#6f7788]">
                      <input
                        checked={accountDraft.acceptedTerms}
                        className="mt-0.5 size-3.5 rounded border-[#d8dceb] accent-[#7a3fe0]"
                        onChange={(event) =>
                          updateAccountField(
                            "acceptedTerms",
                            event.target.checked
                          )
                        }
                        type="checkbox"
                      />
                      <span>I agree to the terms and privacy policy</span>
                    </label>
                    {errors.acceptedTerms && (
                      <p className="-mt-2 text-[11px] text-[#ff3b4f]">
                        {errors.acceptedTerms}
                      </p>
                    )}
                  </div>
                </section>
              )}
              <div>
                <p className="mb-2 text-[11px] font-medium text-[#242a39]">
                  Salon Verification Document
                </p>
                {documentFile ? (
                  <div className="flex h-12 items-center gap-3 rounded-lg bg-white px-3 shadow-sm ring-1 ring-[#eef0f6]">
                    <FileUp className="size-4 text-[#7a3fe0]" />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#242a39]">
                      {documentFile.name}
                    </span>
                    <button
                      aria-label="Remove uploaded document"
                      className="grid size-7 place-items-center rounded-full text-[#8b92a1] hover:bg-[#f0edf8]"
                      onClick={removeDocumentFile}
                      type="button"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    className={[
                      "flex min-h-[110px] w-full flex-col items-center justify-center rounded-lg border bg-[#f8f9ff] px-4 text-center transition",
                      errors.document
                        ? "border-[#ff5964]"
                        : "border-[#ccd2df] hover:border-[#7a3fe0]",
                    ].join(" ")}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-white text-[#9ba2b3] shadow-sm">
                      <Upload className="size-4" />
                    </span>
                    <span className="mt-3 text-[12px] font-semibold text-[#7a3fe0]">
                      Click to upload
                    </span>
                    <span className="text-[11px] text-[#505768]">
                      or drag and drop
                    </span>
                    <span className="mt-1 text-[10px] text-[#9aa1b1]">
                      Proof of ownership (PDF, PNG, JPG)
                    </span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="sr-only"
                  onChange={handleFileChange}
                  type="file"
                />
                {errors.document && (
                  <p className="mt-2 text-[11px] text-[#ff3b4f]">
                    {errors.document}
                  </p>
                )}
              </div>

              <label className="block text-[11px] font-medium text-[#242a39]">
                Salon Location
                {googleMapsApiKey && !mapsError ? (
                  <span
                    className={[
                      "relative mt-1 block rounded-lg border bg-white pl-9 text-[12px] text-[#1b2133] shadow-sm transition",
                      errors.location
                        ? "border-[#ff5964] focus-within:border-[#ff5964] focus-within:ring-3 focus-within:ring-[#ff5964]/10"
                        : "border-transparent focus-within:border-[#232735] focus-within:ring-3 focus-within:ring-[#232735]/10",
                    ].join(" ")}
                  >
                    <MapPin className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[#98a0b1]" />
                    <div
                      ref={locationAutocompleteRef}
                      className="google-place-autocomplete-shell min-h-11"
                    />
                    {mapsLoading && (
                      <span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-[12px] font-normal text-[#a5acbb]">
                        Loading Google Maps...
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="relative mt-1 block">
                    <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#98a0b1]" />
                    <input
                      aria-invalid={Boolean(errors.location)}
                      className={[
                        "h-11 w-full rounded-lg border bg-white px-3 pl-9 text-[12px] text-[#1b2133] outline-none transition placeholder:text-[#a5acbb]",
                        errors.location
                          ? "border-[#ff5964] focus:border-[#ff5964] focus:ring-3 focus:ring-[#ff5964]/10"
                          : "border-transparent focus:border-[#232735] focus:ring-3 focus:ring-[#232735]/10",
                      ].join(" ")}
                      onChange={(event) => {
                        setSalonLocation(event.target.value);
                        setSelectedPlaceId("");
                      }}
                      placeholder="Search salon location..."
                      value={salonLocation}
                    />
                  </span>
                )}
              </label>
              <p className="-mt-2 text-[10px] text-[#8b92a1]">
                {googleMapsApiKey
                  ? "We use Google Maps to verify your salon's location."
                  : "Google Maps verification is temporarily disabled."}
              </p>
              {mapsError && (
                <p className="-mt-2 text-[11px] text-[#ff3b4f]">{mapsError}</p>
              )}
              {errors.location && (
                <p className="-mt-2 text-[11px] text-[#ff3b4f]">
                  {errors.location}
                </p>
              )}
              {registrationError && (
                <p className="-mt-2 text-[11px] text-[#ff3b4f]">
                  {registrationError}
                </p>
              )}

              <button
                className="min-h-12 w-full rounded-lg bg-[linear-gradient(180deg,#8f4df2_0%,#4f1d92_100%)] text-[13px] font-medium text-white shadow-[0_10px_18px_rgb(70_31_139_/_0.42)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-none disabled:bg-[#d9d9d9] disabled:text-[#676767] disabled:shadow-none"
                disabled={isRegistering}
                type="submit"
              >
                {isRegistering ? "Creating account..." : "Submit"}
              </button>
            </form>

            <p className="mt-5 text-center text-[11px] text-[#8b92a1]">
              Already have an account?{" "}
              <Link className="font-medium text-[#7a3fe0]" to="/login">
                Log in
              </Link>
            </p>
          </div>
        </section>
      )}

      {created && (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgb(255_255_255_/_0.42),rgb(34_22_74_/_0.52))] px-8 backdrop-blur-[10px]">
          <div className="w-full max-w-[310px] rounded-xl bg-white px-5 pb-6 pt-5 text-center shadow-[0_26px_46px_rgb(56_31_118_/_0.5)]">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-[linear-gradient(180deg,#8f4df2_0%,#5d2caf_100%)] text-white shadow-[0_12px_24px_rgb(91_44_175_/_0.34)]">
              <Check className="size-9 stroke-[3]" />
            </div>
            <h2 className="mt-5 text-[17px] font-semibold text-[#12192d]">
              Account created!
            </h2>
            <p className="mx-auto mt-2 max-w-[230px] text-[12px] leading-5 text-[#7c8394]">
              You&apos;re all set. Let&apos;s personalize your experience in
              just a few steps.
            </p>
            <button
              className="mt-5 min-h-12 w-full rounded-lg bg-[linear-gradient(180deg,#8f4df2_0%,#4f1d92_100%)] text-[13px] font-medium text-white shadow-[0_10px_18px_rgb(70_31_139_/_0.42)] transition hover:brightness-105"
              onClick={() => {
                if (createdAccount?.salon.id) {
                  window.localStorage.removeItem(
                    `glamhour:onboarding:${createdAccount.salon.id}`
                  );
                }
                navigate("/onboarding/categories", {
                  replace: true,
                  state: {
                    salonId: createdAccount?.salon.id,
                    salonName: createdAccount?.salon.name ?? state.salonName,
                    email: createdAccount?.user.email ?? state.email,
                  },
                });
              }}
              type="button"
            >
              Start onboarding
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function providerLabel(provider: "email" | "google" | "facebook" | "apple") {
  if (provider === "facebook") return "Facebook";
  if (provider === "apple") return "Apple";
  if (provider === "google") return "Google";
  return "email";
}

function RegistrationField({
  error,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block text-[11px] font-medium text-[#242a39]">
      {label}
      <input
        aria-invalid={Boolean(error)}
        className={[
          "mt-1 h-11 w-full rounded-lg border bg-[#f8f9ff] px-3 text-[12px] text-[#1b2133] outline-none transition placeholder:text-[#a5acbb]",
          error
            ? "border-[#ff5964] focus:border-[#ff5964] focus:ring-3 focus:ring-[#ff5964]/10"
            : "border-[#c9ceda] focus:border-[#232735] focus:ring-3 focus:ring-[#232735]/10",
        ].join(" ")}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {error && (
        <span className="mt-1 block text-[11px] font-normal text-[#ff3b4f]">
          {error}
        </span>
      )}
    </label>
  );
}
