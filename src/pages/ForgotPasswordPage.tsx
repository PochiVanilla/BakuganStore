export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6 lg:px-8">
      <div className="rounded-[32px] border border-white/10 bg-surface p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-cyan">Khôi phục</p>
          <h1 className="mt-2 text-3xl font-black text-text">Quên mật khẩu</h1>
        </div>

        <form className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-text">Email</label>
            <input className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-text placeholder:text-text-muted focus:border-accent-cyan focus:outline-none" placeholder="you@example.com" />
          </div>
          <button type="submit" className="w-full rounded-full bg-gradient-to-r from-primary to-accent-pink px-4 py-3 font-bold text-white">Gửi liên kết đặt lại</button>
        </form>
      </div>
    </div>
  );
}
