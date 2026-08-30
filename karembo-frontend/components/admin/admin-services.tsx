"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, api } from "@/lib/api";
import { formatDuration, formatPrice } from "@/lib/format";
import type { Service } from "@/lib/types";
import { AlertCircle, Loader2, Plus, X } from "../icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeading,
  Select,
  Skeleton,
  Textarea,
} from "../ui";

const CATEGORIES = ["Hair", "Braids", "Nails", "Beauty", "Bridal"];

/** "Silk Press" -> "silk-press" */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function AdminServices() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isPending, error } = useQuery({
    queryKey: ["admin", "services"],
    queryFn: () => api.admin.services(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "services"] });
    // The public catalogue and category counts change too.
    void queryClient.invalidateQueries({ queryKey: ["services"] });
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const toggleActive = useMutation({
    // Retiring is a DELETE and restoring is a PATCH, so the two branches return
    // different shapes. Neither result is used — the list is refetched — so
    // collapse both to void rather than widening the mutation's type.
    mutationFn: async (service: Service): Promise<void> => {
      if (service.is_active) {
        await api.admin.retireService(service.id);
      } else {
        await api.admin.updateService(service.id, { is_active: true });
      }
    },
    onSuccess: (_result, service) => {
      toast.success(
        service.is_active
          ? `${service.name} retired.`
          : `${service.name} is live again.`,
      );
      invalidate();
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  return (
    <>
      <PageHeading
        eyebrow="Catalogue"
        title="Services"
        description="Duration drives the booking calendar — change it and future slots resize automatically."
        actions={
          <Button onClick={() => setShowForm((open) => !open)}>
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? "Close" : "Add service"}
          </Button>
        }
      />

      <Alert tone="info" icon={<AlertCircle className="size-4" />} className="mt-6">
        Retiring a service hides it from customers but keeps it on past bookings,
        so your history and reporting stay intact.
      </Alert>

      {showForm && (
        <div className="mt-6">
          <CreateServiceForm
            onCreated={() => {
              setShowForm(false);
              invalidate();
            }}
          />
        </div>
      )}

      <div className="mt-6">
        {error ? (
          <Alert tone="danger">Could not load services. {error.message}</Alert>
        ) : isPending ? (
          <Skeleton className="h-96 rounded-lg" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-sand-200 bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-sand-100 text-left">
                  {["Service", "Category", "Duration", "Price", "Status", ""].map(
                    (heading, index) => (
                      <th
                        key={heading || index}
                        className="whitespace-nowrap px-4 py-3 text-2xs font-semibold uppercase tracking-[0.08em] text-sand-600"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((service) => (
                  <tr
                    key={service.id}
                    className="border-t border-sand-200 hover:bg-plum-50"
                  >
                    <td className="px-4 py-4">
                      <div className="font-medium">{service.name}</div>
                      <div className="font-mono text-xs text-sand-500">
                        {service.slug}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone="brand">{service.category}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 numeric">
                      {formatDuration(service.duration_min)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right numeric">
                      {formatPrice(service.price_cents)}
                    </td>
                    <td className="px-4 py-4">
                      {service.is_active ? (
                        <Badge tone="success" dot>
                          Active
                        </Badge>
                      ) : (
                        <Badge tone="neutral" dot>
                          Retired
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        variant={service.is_active ? "danger" : "secondary"}
                        size="sm"
                        disabled={toggleActive.isPending}
                        onClick={() => toggleActive.mutate(service)}
                      >
                        {service.is_active ? "Retire" : "Restore"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function CreateServiceForm({ onCreated }: { onCreated: () => void }) {
  const [values, setValues] = useState({
    name: "",
    category: CATEGORIES[0],
    duration_min: "60",
    // Entered in whole KES; converted to minor units on submit.
    price: "2500",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () =>
      api.admin.createService({
        name: values.name.trim(),
        slug: slugify(values.name),
        category: values.category,
        duration_min: Number(values.duration_min),
        price_cents: Math.round(Number(values.price) * 100),
        description: values.description.trim(),
      }),
    onSuccess: (service) => {
      toast.success(`${service.name} created.`);
      setValues({
        name: "",
        category: CATEGORIES[0],
        duration_min: "60",
        price: "2500",
        description: "",
      });
      setErrors({});
      onCreated();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ name: "A service with that name already exists." });
      } else if (error instanceof ApiError && error.status === 422) {
        setErrors({ duration_min: error.message });
      } else {
        toast.error(error.message);
      }
    },
  });

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  return (
    <Card>
      <h2 className="text-xl">Add a service</h2>
      <form
        className="mt-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const found: Record<string, string> = {};

          if (values.name.trim().length < 2) {
            found.name = "Enter a service name.";
          } else if (!slugify(values.name)) {
            found.name = "Name must contain at least one letter or number.";
          }

          const duration = Number(values.duration_min);
          if (!Number.isInteger(duration) || duration < 1 || duration > 600) {
            found.duration_min = "Duration must be 1–600 minutes.";
          }

          const price = Number(values.price);
          if (!Number.isFinite(price) || price < 0) {
            found.price = "Enter a price of zero or more.";
          }

          if (Object.keys(found).length > 0) {
            setErrors(found);
            return;
          }
          create.mutate();
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="svc-name" required error={errors.name}>
            <Input
              id="svc-name"
              value={values.name}
              invalid={Boolean(errors.name)}
              onChange={(event) => update("name", event.target.value)}
              placeholder="e.g. Scalp Treatment"
            />
          </Field>
          <Field label="Category" htmlFor="svc-category" required>
            <Select
              id="svc-category"
              value={values.category}
              onChange={(event) => update("category", event.target.value)}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Duration (minutes)"
            htmlFor="svc-duration"
            required
            error={errors.duration_min}
            hint="1–600. Slots are offered every 15 minutes."
          >
            <Input
              id="svc-duration"
              type="number"
              min={1}
              max={600}
              value={values.duration_min}
              invalid={Boolean(errors.duration_min)}
              onChange={(event) => update("duration_min", event.target.value)}
              className="numeric"
            />
          </Field>
          <Field
            label="Price (KES)"
            htmlFor="svc-price"
            required
            error={errors.price}
          >
            <Input
              id="svc-price"
              type="number"
              min={0}
              step={50}
              value={values.price}
              invalid={Boolean(errors.price)}
              onChange={(event) => update("price", event.target.value)}
              className="numeric"
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Description" htmlFor="svc-description">
            <Textarea
              id="svc-description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="What the client should expect."
            />
          </Field>
        </div>

        {values.name.trim() && (
          <p className="mt-3 text-xs text-sand-600">
            URL slug will be{" "}
            <code className="font-mono">{slugify(values.name)}</code>
          </p>
        )}

        <Button type="submit" className="mt-6" disabled={create.isPending}>
          {create.isPending && <Loader2 className="size-4 animate-spin" />}
          Create service
        </Button>
      </form>
    </Card>
  );
}
