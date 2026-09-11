import { FormEvent, useEffect, useRef, useState } from 'react'
import { Mail, Phone, MapPin, Send, MessageCircle, Twitter, Github, Linkedin } from 'lucide-react'
import { sendContactMessage } from '../lib/contact'
import { Card, Button } from '../components/ui'

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start rs-fade-up max-w-[68rem]">
            {/* Left: who we are and how to reach us. */}
            <section>
                <h1 className="rs-display">Get in touch</h1>
                <p className="text-[15px] text-[var(--rs-text-muted)] leading-relaxed mt-3 max-w-md">
                    Tell us what you need and our team will respond quickly with next steps.
                </p>

                <Card className="p-5 mt-7">
                    <h2 className="rs-heading">About RoadSense</h2>
                    <p className="text-[14px] text-[var(--rs-text-muted)] leading-relaxed mt-2">
                        RoadSense combines mobile sensing, cloud intelligence, and map analytics to prioritize road
                        issues faster.
                    </p>
                    <p className="rs-kicker text-[var(--rs-primary-text)] mt-4">Drive safe, stay safe.</p>
                </Card>

                <dl className="mt-7 space-y-4">
                    <Info icon={<Mail size={15} />} label="Email" value="work.utkarshjha@gmail.com" href="mailto:work.utkarshjha@gmail.com" />
                    <Info icon={<Phone size={15} />} label="Phone" value="+91 7061771437" href="tel:+917061771437" />
                    <Info icon={<MapPin size={15} />} label="Address" value="123 Design St, San Francisco, CA" />
                </dl>

                <div className="mt-7 flex gap-2">
                    {SOCIALS.map(({ icon: Icon, label }) => (
                        <button key={label} type="button" className="rs-icon-button" aria-label={label}>
                            <Icon size={16} />
                        </button>
                    ))}
                </div>
            </section>

            {/* Right: the form. */}
            <Card className="p-5 sm:p-6">
                <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="Full Name">
                            <input value={name} onChange={(e) => setName(e.target.value)} className="rs-input" placeholder="John Doe" />
                        </Field>
                        <Field label="Email Address">
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rs-input" placeholder="john@example.com" />
                        </Field>
                    </div>

                    <Field label="Subject">
                        <input value={subject} onChange={(e) => setsubject(e.target.value)} className="rs-input" placeholder="How can we help?" />
                    </Field>

                    <Field label="Message">
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="rs-input min-h-[9.5rem] resize-none"
                            placeholder="Tell us about your project..."
                        />
                    </Field>

                    {recaptchaSiteKey ? (
                        <div ref={captchaContainerRef} className="min-h-[78px]" />
                    ) : (
                        <div className="rs-banner rs-banner-warn">
                            Missing <code className="rs-mono">VITE_RECAPTCHA_SITE_KEY</code> in web env.
                        </div>
                    )}

                    {status && (
                        <div className={`rs-banner ${status.type === 'success' ? 'rs-banner-success' : 'rs-banner-danger'}`}>
                            {status.text}
                        </div>
                    )}

                    <Button type="submit" icon={Send} disabled={submitting || !captchaToken} className="w-full">
                        {submitting ? 'Sending...' : 'Send Message'}
                    </Button>

                    <p className="text-[13px] text-[var(--rs-text-faint)] flex items-center gap-2 pt-1">
                        <MessageCircle size={14} />
                        Prefer a quick chat? Schedule a call.
                    </p>
                </form>
            </Card>
        </div>
    )
}

const SOCIALS = [
    { icon: Twitter, label: 'Twitter' },
    { icon: Github, label: 'GitHub' },
    { icon: Linkedin, label: 'LinkedIn' },
] as const

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="rs-label">{label}</span>
            {children}
        </label>
    )
}

/** One contact line: faint label in a fixed column, value beside it. */
function Info({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
    return (
        <div className="flex items-baseline gap-4">
            <dt className="flex items-center gap-2 w-[5.5rem] shrink-0 text-[13px] text-[var(--rs-text-faint)]">
                <span className="translate-y-[2px]">{icon}</span>
                {label}
            </dt>
            <dd className="m-0 text-[14px] font-medium text-[var(--rs-text)] break-all">
                {href ? (
                    <a href={href} className="text-[var(--rs-text)] no-underline hover:text-[var(--rs-primary-text)]">
                        {value}
                    </a>
                ) : (
                    value
                )}
            </dd>
        </div>
    )
}
