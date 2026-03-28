import { FormEvent, useEffect, useRef, useState } from 'react'
import { Mail, Phone, MapPin, Send, MessageCircle, Twitter, Github, Linkedin } from 'lucide-react'
import { sendContactMessage } from '../lib/contact'

declare global {
    interface Window {
        grecaptcha?: {
            render: (
                container: HTMLElement,
                params: {
                    sitekey: string
                    callback: (token: string) => void
                    'expired-callback'?: () => void
                }
            ) => number
            reset: (widgetId?: number) => void
        }
    }
}

export default function About() {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [subject, setsubject] = useState('')
    const [message, setMessage] = useState('')
    const [captchaToken, setCaptchaToken] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const captchaContainerRef = useRef<HTMLDivElement | null>(null)
    const captchaWidgetIdRef = useRef<number | null>(null)
    const recaptchaSiteKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim()

    useEffect(() => {
        if (!recaptchaSiteKey || !captchaContainerRef.current) {
            return
        }

        function renderCaptcha() {
            if (!window.grecaptcha || !captchaContainerRef.current || captchaWidgetIdRef.current !== null) {
                return
            }
            captchaWidgetIdRef.current = window.grecaptcha.render(captchaContainerRef.current, {
                sitekey: recaptchaSiteKey,
                callback: (token: string) => setCaptchaToken(token),
                'expired-callback': () => setCaptchaToken(''),
            })
        }

        if (!document.querySelector('script[data-rs-recaptcha="1"]')) {
            const script = document.createElement('script')
            script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
            script.async = true
            script.defer = true
            script.dataset.rsRecaptcha = '1'
            script.onload = renderCaptcha
            document.body.appendChild(script)
        } else {
            renderCaptcha()
        }

        const interval = window.setInterval(() => {
            if (window.grecaptcha && captchaWidgetIdRef.current === null) {
                renderCaptcha()
            }
        }, 250)

        return () => window.clearInterval(interval)
    }, [recaptchaSiteKey])

    async function handleSubmit(event: FormEvent) {
        event.preventDefault()
        setStatus(null)

        if (!name.trim() || !email.trim() || !message.trim()) {
            setStatus({ type: 'error', text: 'Please fill name, email, and message.' })
            return
        }
        if (!captchaToken) {
            setStatus({ type: 'error', text: 'Please complete reCAPTCHA verification first.' })
            return
        }

        try {
            setSubmitting(true)
            await sendContactMessage({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                subject: subject.trim(),
                message: message.trim(),
                source: 'web',
                recaptchaToken: captchaToken,
            })
            setStatus({ type: 'success', text: 'Message sent. We also emailed you a confirmation.' })
            setMessage('')
            setCaptchaToken('')
            if (window.grecaptcha && captchaWidgetIdRef.current !== null) {
                window.grecaptcha.reset(captchaWidgetIdRef.current)
            }
        } catch (err) {
            const text = err instanceof Error ? err.message : 'Failed to send message'
            setStatus({ type: 'error', text })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <section className="min-h-[calc(100vh-220px)] flex items-center">
            <div className="w-full rs-panel p-0 overflow-hidden">
                <div className="grid lg:grid-cols-5">
                    <div className="lg:col-span-2 p-8 md:p-10 bg-[linear-gradient(140deg,#1c4f7f,#2c6ca2)] text-white relative">
                        <div className="absolute top-0 right-0 w-60 h-60 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-black/20 blur-3xl translate-y-1/2 -translate-x-1/2" />
                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-4xl font-black leading-tight">Get in touch.</h2>
                            <p className="mt-4 text-white/80">
                                Tell us what you need and our team will respond quickly with next steps.
                            </p>

                            <div className="mt-6 rounded-2xl border border-white/20 bg-white/10 px-4 py-4">
                                <h3 className="text-2xl font-bold text-white">About RoadSense</h3>
                                <p className="mt-2 text-white/85 leading-relaxed">
                                    RoadSense combines mobile sensing, cloud intelligence, and map analytics to prioritize road issues faster.
                                </p>
                                <p className="mt-3 text-sm uppercase tracking-[0.14em] font-semibold text-[var(--rs-accent)]">
                                    Drive safe, stay safe.
                                </p>
                            </div>

                            <div className="mt-10 space-y-5">
                                <Info icon={<Mail size={16} />} label="Email us" value="work.utkarshjha@gmail.com" href="mailto:work.utkarshjha@gmail.com" />
                                <Info icon={<Phone size={16} />} label="Call us" value="7061771437" />
                                <Info icon={<MapPin size={16} />} label="Visit us" value="123 Design St, SF, CA" />
                            </div>

                            <div className="mt-10 flex gap-3">
                                {[Twitter, Github, Linkedin].map((Icon, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center"
                                    >
                                        <Icon size={14} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-3 p-8 md:p-10 bg-[var(--rs-panel-soft)]">
                        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
                            <div className="grid md:grid-cols-2 gap-5">
                                <Field label="Full Name">
                                    <input value={name} onChange={(e) => setName(e.target.value)} className="rs-input w-full" placeholder="John Doe" />
                                </Field>
                                <Field label="Email Address">
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rs-input w-full" placeholder="john@example.com" />
                                </Field>
                            </div>

                            <Field label="Subject">
                                <input value={subject} onChange={(e) => setsubject(e.target.value)} className="rs-input w-full" placeholder="ACME Corp" />
                            </Field>

                            <Field label="Your Message">
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="rs-input w-full min-h-32 resize-none"
                                    placeholder="Tell us about your project..."
                                />
                            </Field>

                            <div>
                                {recaptchaSiteKey ? (
                                    <div ref={captchaContainerRef} className="min-h-[78px]" />
                                ) : (
                                    <div className="rounded-xl border border-[#7b3d3d] bg-[#3b2222] text-[#ffb7b7] px-4 py-3 text-sm">
                                        Missing <code>VITE_RECAPTCHA_SITE_KEY</code> in web env.
                                    </div>
                                )}
                            </div>

                            {status && (
                                <div className={`rounded-xl border px-4 py-3 text-sm ${status.type === 'success'
                                    ? 'border-[#2d7a56] bg-[#1b3a2d] text-[#b7f1d5]'
                                    : 'border-[#7b3d3d] bg-[#3b2222] text-[#ffb7b7]'
                                    }`}>
                                    {status.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting || !captchaToken}
                                className="w-full h-12 rounded-xl bg-[var(--rs-accent)] text-[#022033] font-bold flex items-center justify-center gap-2 hover:brightness-105 transition disabled:opacity-70"
                            >
                                <Send size={16} />
                                {submitting ? 'Sending...' : 'Send Message'}
                            </button>

                            <div className="pt-2 flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-[var(--rs-muted)]">
                                <MessageCircle size={14} className="text-[var(--rs-accent)]" />
                                <span>Prefer a quick chat? Schedule a call.</span>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--rs-muted)] mb-2">{label}</p>
            {children}
        </label>
    )
}

function Info({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">{icon}</div>
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">{label}</p>
                {href ? (
                    <a href={href} className="text-sm font-semibold no-underline hover:no-underline focus:no-underline">
                        {value}
                    </a>
                ) : (
                    <p className="text-sm font-semibold">{value}</p>
                )}
            </div>
        </div>
    )
}
