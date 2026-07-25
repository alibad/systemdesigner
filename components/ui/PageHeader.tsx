type PageHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon ? <div className="text-neutral-700 dark:text-neutral-300">{icon}</div> : null}
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}





