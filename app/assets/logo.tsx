import type { SVGProps } from "react";

export type LogoProps = SVGProps<SVGSVGElement>;
export type LogoVariant = "isotype" | "logotype" | "imagotype";
export interface PromptierLogoProps extends LogoProps {
    variant?: LogoVariant;
    label?: string;
    decorative?: boolean;
}
const baseSvgProps = {
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
    height: 20,
    focusable: false,
    preserveAspectRatio: "xMidYMid meet",
} as const;

const COLOR = "currentColor";
const STROKECOLOR = "#0000"

export function Logo({
    variant = "imagotype",
    label = "Promptier",
    decorative = false,
    ...props
}: PromptierLogoProps) {
    const Component = variant === "isotype" ? Isotype : variant === "logotype" ? Logotype : Imagotype;

    return (
        <Component
            role={decorative ? "presentation" : "img"}
            aria-hidden={decorative || undefined}
            aria-label={decorative ? undefined : label}
            {...props}
        />
    );
}

export function Isotype(props: LogoProps) {
    return (
        <svg {...baseSvgProps} viewBox="0 0 120 120" {...props}>
            <path 
                d="m37.4 107.9h-18.1c-3.7 0-7.3-3.5-7.3-7.9v-79c0-4.3 4-8.4 7.3-8.4h18.1v-5.7h-18.5c-6.7 0-13 5.4-13 13.7v79.9c0.7 7.5 6.7 13.4 13.4 13.4h18.1v-6z"
                fill={COLOR}
                stroke={STROKECOLOR}
                strokeWidth={1.25}
                strokeMiterlimit={10}
                vectorEffect="non-scaling-stroke"
                />
            <path
                d="m101 6.9h-17.7v6.1h17.7c3.3 0 7 3.1 7 8v79.5c0 4.3-3.5 7.4-7 7.4h-18v5.8h18c6.2 0 13.1-5.6 13.1-13.5v-79.8c0-6.7-5.8-13.1-13.1-13.5z"
                fill={COLOR}
                stroke={STROKECOLOR}
                strokeWidth={1.25}
                strokeMiterlimit={10}
                vectorEffect="non-scaling-stroke"
                />
            <path
                d="m34 39-4.1 4.2 15.7 16.4-15.7 15.9 4.1 4.2 19.9-19.6v-1.2z"
                fill={COLOR}
                stroke={STROKECOLOR}
                strokeWidth={1.5}
                strokeMiterlimit={10}
                vectorEffect="non-scaling-stroke"
                />
            <path
                d="m61.1 81.3-1.6 1.6v2.9l1.6 2.2h24.8l2-1.4 0.2-0.8v-2.6l-1.7-1.9z"
                fill={COLOR}
                stroke={STROKECOLOR}
                strokeWidth={1.5}
                strokeMiterlimit={10}
                vectorEffect="non-scaling-stroke"
                />
        </svg>
    )
}

export function Logotype(props: LogoProps) {
    return (
        <svg
            {...baseSvgProps}
            width={193}
            viewBox="0 0 193 42"
            fillRule="evenodd"
            clipRule="evenodd"
            strokeLinejoin="round"
            strokeMiterlimit={2}
            {...props}
        >
            <g transform="matrix(1,0,0,1,-1903.8,-1479.45)">
                <g id="Name">
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M35,27.1L29.7,27.1L29.7,32.9L27.4,32.9L27.4,17.9L35,17.9L37.5,20L37.5,24.7L35,27.1ZM35.3,21L34.4,20L29.8,20L29.8,24.9L34.3,24.9L35.3,24L35.3,21Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M52.9,32.9L49.6,26.7L46.8,26.7L46.8,32.9L44.5,32.9L44.5,17.9L52.4,17.9L54.8,20L54.8,24.4L52,26.6L55,32L55,32.9L52.9,32.9ZM52.6,21L51.6,20.1L46.9,20.1L46.9,24.5L51.5,24.5L52.6,23.4L52.6,21Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M69.9,33L63.8,33L61.7,30.7L61.7,20.1L63.8,17.9L70,17.9L72.2,20.1L72.2,30.7L69.9,33ZM69.9,20.9L69.1,20L64.8,20L64,20.9L64,30L64.9,31L69,31L69.9,30L69.9,20.9Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M88.1,32.9L88.1,21.6L85.8,27.5L83.8,27.5L81.4,21.6L81.4,32.9L79.2,32.9L79.2,17.9L82,17.9L84.7,25.2L87.5,17.9L90.3,17.9L90.3,32.9L88.1,32.9Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M105,27.1L99.8,27.1L99.8,32.9L97.6,32.9L97.6,17.9L105,17.9L107.3,20L107.3,24.9L105,27.1ZM105.1,21L104.2,20L99.8,20L99.8,25.1L104,25.1L105.1,24.1L105.1,21Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M120.5,20L120.5,32.9L118.3,32.9L118.3,20L114,20L114,17.9L124.6,17.9L124.6,20L120.5,20Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M131.7,32.9L131.7,30.9L134.3,30.9L134.3,20L131.7,20L131.7,17.9L138.9,17.9L138.9,20L136.5,20L136.5,30.9L138.9,30.9L138.9,32.9L131.7,32.9Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M146.5,32.9L146.5,17.9L156.2,17.9L156.2,20L148.9,20L148.9,24.1L155.1,24.1L155.1,26.2L148.9,26.2L148.9,30.9L156.3,30.9L156.3,32.9L146.5,32.9Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M174.7,32.9L172.6,32.9L169.277,26.683L167.9,26.7L165.9,26.7L165.9,32.9L163.6,32.9L163.6,17.9L171.8,17.9L174.2,20L174.2,24.7L171.6,26.6L174.7,32.1L174.7,32.9ZM171.9,21L170.9,20L165.9,20L165.9,24.7L170.8,24.7L171.9,23.9L171.9,21Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                </g>

                <g id="Decorations">
                    <g transform="matrix(0,-1,1,0,1899.4,1675.95)">
                        <path d="M195.217,5.8L186.928,5.8C186.528,5.8 186.313,5.428 186.306,5.137C186.296,4.737 186.58,4.417 186.9,4.4L196.5,4.4L196.5,14C196.5,14.4 196.339,14.794 195.819,14.8C195.428,14.805 195.17,14.5 195.17,14.1L195.217,5.8Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(-1,0,-0,-1,2100.3,1524.95)">
                        <path d="M195.217,5.8L186.928,5.8C186.528,5.8 186.313,5.428 186.306,5.137C186.296,4.737 186.58,4.417 186.9,4.4L196.5,4.4L196.5,14C196.5,14.4 196.339,14.794 195.819,14.8C195.428,14.805 195.17,14.5 195.17,14.1L195.217,5.8Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M195.217,5.8L186.928,5.8C186.528,5.8 186.313,5.428 186.306,5.137C186.296,4.737 186.58,4.417 186.9,4.4L196.5,4.4L196.5,14C196.5,14.4 196.339,14.794 195.819,14.8C195.428,14.805 195.17,14.5 195.17,14.1L195.217,5.8Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(0.000516,1,-1,0.000516,2100.598588,1324.042801)">
                        <path d="M195.217,5.8L186.928,5.8C186.528,5.8 186.313,5.428 186.306,5.137C186.296,4.737 186.58,4.417 186.9,4.4L196.5,4.4L196.5,14C196.5,14.4 196.339,14.794 195.819,14.8C195.428,14.805 195.17,14.5 195.17,14.1L195.217,5.8Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                </g>
            </g>
        </svg>
    )
}

export function Imagotype(props: LogoProps) {
    return (
        <svg
            {...baseSvgProps}
            width={210}
            viewBox="0 0 210 42"
            fillRule="evenodd"
            clipRule="evenodd"
            strokeLinejoin="round"
            strokeMiterlimit={2}
            {...props}
        >
            <g id="Isotype" transform="scale(0.35)">
                <path
                    d="m37.4 107.9h-18.1c-3.7 0-7.3-3.5-7.3-7.9v-79c0-4.3 4-8.4 7.3-8.4h18.1v-5.7h-18.5c-6.7 0-13 5.4-13 13.7v79.9c0.7 7.5 6.7 13.4 13.4 13.4h18.1v-6z"
                    fill={COLOR}
                    stroke={STROKECOLOR}
                    strokeWidth={1.25}
                    strokeMiterlimit={10}
                    vectorEffect="non-scaling-stroke"
                />
                <path
                    d="m101 6.9h-17.7v6.1h17.7c3.3 0 7 3.1 7 8v79.5c0 4.3-3.5 7.4-7 7.4h-18v5.8h18c6.2 0 13.1-5.6 13.1-13.5v-79.8c0-6.7-5.8-13.1-13.1-13.5z"
                    fill={COLOR}
                    stroke={STROKECOLOR}
                    strokeWidth={1.25}
                    strokeMiterlimit={10}
                    vectorEffect="non-scaling-stroke"
                />
                <path
                    d="m34 39-4.1 4.2 15.7 16.4-15.7 15.9 4.1 4.2 19.9-19.6v-1.2z"
                    fill={COLOR}
                    stroke={STROKECOLOR}
                    strokeWidth={1.5}
                    strokeMiterlimit={10}
                    vectorEffect="non-scaling-stroke"
                />
                <path
                    d="m61.1 81.3-1.6 1.6v2.9l1.6 2.2h24.8l2-1.4 0.2-0.8v-2.6l-1.7-1.9z"
                    fill={COLOR}
                    stroke={STROKECOLOR}
                    strokeWidth={1.5}
                    strokeMiterlimit={10}
                    vectorEffect="non-scaling-stroke"
                />
            </g>

            <g id="Name" transform="translate(36.6, 0)">
                <g transform="matrix(1,0,0,1,-1903.8,-1479.45)">
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M35,27.1L29.7,27.1L29.7,32.9L27.4,32.9L27.4,17.9L35,17.9L37.5,20L37.5,24.7L35,27.1ZM35.3,21L34.4,20L29.8,20L29.8,24.9L34.3,24.9L35.3,24L35.3,21Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M52.9,32.9L49.6,26.7L46.8,26.7L46.8,32.9L44.5,32.9L44.5,17.9L52.4,17.9L54.8,20L54.8,24.4L52,26.6L55,32L55,32.9L52.9,32.9ZM52.6,21L51.6,20.1L46.9,20.1L46.9,24.5L51.5,24.5L52.6,23.4L52.6,21Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M69.9,33L63.8,33L61.7,30.7L61.7,20.1L63.8,17.9L70,17.9L72.2,20.1L72.2,30.7L69.9,33ZM69.9,20.9L69.1,20L64.8,20L64,20.9L64,30L64.9,31L69,31L69.9,30L69.9,20.9Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M88.1,32.9L88.1,21.6L85.8,27.5L83.8,27.5L81.4,21.6L81.4,32.9L79.2,32.9L79.2,17.9L82,17.9L84.7,25.2L87.5,17.9L90.3,17.9L90.3,32.9L88.1,32.9Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M105,27.1L99.8,27.1L99.8,32.9L97.6,32.9L97.6,17.9L105,17.9L107.3,20L107.3,24.9L105,27.1ZM105.1,21L104.2,20L99.8,20L99.8,25.1L104,25.1L105.1,24.1L105.1,21Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M120.5,20L120.5,32.9L118.3,32.9L118.3,20L114,20L114,17.9L124.6,17.9L124.6,20L120.5,20Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M131.7,32.9L131.7,30.9L134.3,30.9L134.3,20L131.7,20L131.7,17.9L138.9,17.9L138.9,20L136.5,20L136.5,30.9L138.9,30.9L138.9,32.9L131.7,32.9Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M146.5,32.9L146.5,17.9L156.2,17.9L156.2,20L148.9,20L148.9,24.1L155.1,24.1L155.1,26.2L148.9,26.2L148.9,30.9L156.3,30.9L156.3,32.9L146.5,32.9Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                    <g transform="matrix(1,0,0,1,1899.8,1475.05)">
                        <path d="M174.7,32.9L172.6,32.9L169.277,26.683L167.9,26.7L165.9,26.7L165.9,32.9L163.6,32.9L163.6,17.9L171.8,17.9L174.2,20L174.2,24.7L171.6,26.6L174.7,32.1L174.7,32.9ZM171.9,21L170.9,20L165.9,20L165.9,24.7L170.8,24.7L171.9,23.9L171.9,21Z" fill={COLOR} fillRule="nonzero" />
                    </g>
                </g>
            </g>
        </svg>
    )
}
