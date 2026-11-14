"use client";

/** Maria's phone: a plain device frame around the real approval page for the waiting order. */
export function PhoneStage({ orderId, approver }: { orderId: string; approver: string }) {
  return (
    <div className="tour-phone" data-tour-phone>
      <div className="tour-phone-notch" aria-hidden="true" />
      <iframe className="tour-phone-screen" src={`/approve/${encodeURIComponent(orderId)}?embed=1`} title={`${approver}’s phone: the order waiting for her approval`} />
    </div>
  );
}
