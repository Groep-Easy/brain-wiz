interface BlockIconProps {
    icon: string
    label: string
}

export function BlockIcon({ icon, label }: BlockIconProps) {
    return (
        <img
            src={icon}
            alt={`${label} icon`}
            className="block-icon"
        />
    )
}
