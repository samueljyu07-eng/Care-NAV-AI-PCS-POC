function answerText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : "Not added";
}

export function IntakeSummary({
  age,
  city,
  timeline,
  symptoms,
  concerns,
  pastAttempts,
}: {
  age: string;
  city: string;
  timeline: string;
  symptoms: string;
  concerns: string;
  pastAttempts: string;
}) {
  return (
    <section
      aria-label="Your intake answers"
      className="rounded-xl border border-[#E2E2E2] bg-[#F6F6F6] px-4 py-4"
    >
      <h2 className="text-base font-semibold text-black">Your answers</h2>
      <dl className="mt-3 grid gap-3 text-base leading-7 text-black sm:grid-cols-2">
        <div>
          <dt className="text-sm text-[#545454]">Age</dt>
          <dd>{answerText(age)}</dd>
        </div>
        <div>
          <dt className="text-sm text-[#545454]">City</dt>
          <dd>{answerText(city)}</dd>
        </div>
        <div>
          <dt className="text-sm text-[#545454]">Timeline</dt>
          <dd>{answerText(timeline)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-[#545454]">Primary symptoms</dt>
          <dd>{answerText(symptoms)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-[#545454]">Main concerns</dt>
          <dd className="line-clamp-2">{answerText(concerns)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-[#545454]">Past attempts</dt>
          <dd className="line-clamp-2">{answerText(pastAttempts)}</dd>
        </div>
      </dl>
    </section>
  );
}
