import { useState } from 'react';
import { Globe } from 'lucide-react';
import { iconUrlForHost } from '../../lib/siteIcon';

const getDomain = (url) => {
    if (!url) return '';
    try {
        const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
        const parsed = new URL(fullUrl);
        return parsed.hostname.replace('www.', '');
    } catch {
        return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    }
};

const getInitials = (title, url) => {
    if (title && title.trim()) {
        return title.trim().charAt(0).toUpperCase();
    }
    const domain = getDomain(url);
    if (domain) {
        return domain.charAt(0).toUpperCase();
    }
    return '?';
};

const getBgColor = (text) => {
    const colors = [
        'bg-blue-600',
        'bg-emerald-600',
        'bg-purple-600',
        'bg-indigo-600',
        'bg-pink-600',
        'bg-amber-600',
        'bg-cyan-600',
        'bg-rose-600'
    ];
    let hash = 0;
    const str = text || 'vault';
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
};

export default function FaviconImage({ url, title, size = 'md' }) {
    const [hasError, setHasError] = useState(false);
    const domain = getDomain(url);
    const iconUrl = iconUrlForHost(domain);

    const sizeClasses = {
        sm: 'w-7 h-7 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base'
    }[size] || 'w-10 h-10 text-sm';

    const iconSizes = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6'
    }[size] || 'w-5 h-5';

    if (!iconUrl || hasError) {
        const initial = getInitials(title, url);
        const bgColor = getBgColor(title || domain);
        return (
            <div className={`${sizeClasses} rounded-xl ${bgColor} text-white font-bold flex items-center justify-center shrink-0 shadow-sm select-none`}>
                {initial !== '?' ? initial : <Globe className={iconSizes} />}
            </div>
        );
    }

    return (
        <div className={`${sizeClasses} rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0 p-1`}>
            <img
                src={iconUrl}
                alt={`${title || domain} icon`}
                className="w-full h-full object-contain rounded"
                onError={() => setHasError(true)}
                loading="lazy"
            />
        </div>
    );
}
