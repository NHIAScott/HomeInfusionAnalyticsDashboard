import * as React from "react";

const Table = React.forwardRef(({ className = "", ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={`w-full caption-bottom text-sm ${className}`} {...props} />
  </div>
));

const TableHeader = React.forwardRef(({ className = "", ...props }, ref) => (
  <thead ref={ref} className={`[&_tr]:border-b [&_tr]:border-slate-200 ${className}`} {...props} />
));

const TableBody = React.forwardRef(({ className = "", ...props }, ref) => (
  <tbody ref={ref} className={`[&_tr:last-child]:border-0 ${className}`} {...props} />
));

const TableRow = React.forwardRef(({ className = "", ...props }, ref) => (
  <tr
    ref={ref}
    className={`border-b border-slate-200 transition-colors hover:bg-slate-50 data-[state=selected]:bg-slate-100 ${className}`}
    {...props}
  />
));

const TableHead = React.forwardRef(({ className = "", ...props }, ref) => (
  <th
    ref={ref}
    className={`h-10 px-2 text-left align-middle font-medium text-slate-500 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[0.5px] ${className}`}
    {...props}
  />
));

const TableCell = React.forwardRef(({ className = "", ...props }, ref) => (
  <td
    ref={ref}
    className={`p-2 align-middle text-slate-900 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[0.5px] ${className}`}
    {...props}
  />
));

Table.displayName = "Table";
TableHeader.displayName = "TableHeader";
TableBody.displayName = "TableBody";
TableRow.displayName = "TableRow";
TableHead.displayName = "TableHead";
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };