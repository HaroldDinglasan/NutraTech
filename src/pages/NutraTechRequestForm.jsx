"use client"

import { useState, useEffect } from "react"
import "../styles/NutratechForm.css"
import { useLocation, useNavigate } from "react-router-dom"

import NutraTechlogo from "../assets/NTBI.png"
import avliLogo from "../assets/AVLI.png"
import apthealthLogo from "../assets/apthealth inc full logo.png"

import nutraheaderlogo from "../assets/nutratechlogo.jpg"
import apthealtheaderLogo from "../assets/apthealth logo.png"
import avliheaderLogo from "../assets/avli biocare.logo.png"

import StockcodeModal from "./StockcodeModal"
import UomModal from "../components/UomModal"
import { CancelButton, AddRowButton, UncancelButton } from "../components/button"
import { savePrfHeader, savePrfDetails, updatePrfDetails, cancelPrf, uncancelPrf } from "../components/button-function"
import axios from "axios"

const NutraTechForm = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [company, setCompany] = useState("NutraTech Biopharma, Inc") // Default value
  const [purchaseCodeNumber, setPurchaseCodeNumber] = useState("")
  const [prfId, setPrfId] = useState(null) // Store the PRF ID
  const [isUpdating, setIsUpdating] = useState(false) // Track if we're in update mode
  const [isPrfCancelled, setIsPrfCancelled] = useState(false) // Track if the PRF is cancelled
  const [cancelButtonLabel, setCancelButtonLabel] = useState("Cancel")
  const [prfDate, setPrfDate] = useState(null) // Store the PRF date
  const [isSameDay, setIsSameDay] = useState(true) // Track if PRF date is the same as current date

  const fullname = localStorage.getItem("userFullname") || "" // Retrieve fullname
  const department = localStorage.getItem("userDepartment") || "" // Retrieve department
  const [isUomModalOpen, setIsUomModalOpen] = useState(false)
  const [selectedUomRowIndex, setSelectedUomRowIndex] = useState(null)

  // State for approval names
  const [approvalNames, setApprovalNames] = useState({
    checkedByUser: localStorage.getItem("checkedByUser") || "",
    approvedByUser: localStorage.getItem("approvedByUser") || "",
    receivedByUser: localStorage.getItem("receivedByUser") || "",
  })

  // Listen for approval settings updates
  useEffect(() => {
    const handleApprovalSettingsUpdated = (event) => {
      if (event.detail) {
        setApprovalNames({
          checkedByUser: event.detail.checkedByUser || "",
          approvedByUser: event.detail.approvedByUser || "",
          receivedByUser: event.detail.receivedByUser || "",
        })
      }
    }

    window.addEventListener("approvalSettingsUpdated", handleApprovalSettingsUpdated)
    return () => {
      window.removeEventListener("approvalSettingsUpdated", handleApprovalSettingsUpdated)
    }
  }, [])

  // Fetch approval settings when component mounts
  useEffect(() => {
    const fetchApprovalSettings = async () => {
      const userId = localStorage.getItem("userId")
      if (!userId) return

      try {
        const response = await axios.get(`http://localhost:5000/api/approvals/user/${userId}`)

        if (response.data.data && response.data.data.length > 0) {
          const approval = response.data.data[0]

          // Fetch employee names for the IDs
          const fetchEmployeeNames = async (ids) => {
            const names = {}

            for (const [key, id] of Object.entries(ids)) {
              if (id) {
                try {
                  const empResponse = await axios.get(`http://localhost:5000/api/employee/${id}`)
                  if (empResponse.data && empResponse.data.FullName) {
                    names[key] = empResponse.data.FullName
                  }
                } catch (error) {
                  console.error(`Error fetching employee for ${key}:`, error)
                }
              }
            }

            return names
          }

          const employeeNames = await fetchEmployeeNames({
            checkedByUser: approval.CheckedById,
            approvedByUser: approval.ApprovedById,
            receivedByUser: approval.ReceivedById,
          })

          // Update state with fetched names
          setApprovalNames({
            checkedByUser: employeeNames.checkedByUser || localStorage.getItem("checkedByUser") || "",
            approvedByUser: employeeNames.approvedByUser || localStorage.getItem("approvedByUser") || "",
            receivedByUser: employeeNames.receivedByUser || localStorage.getItem("receivedByUser") || "",
          })

          // Also update localStorage
          if (employeeNames.checkedByUser) localStorage.setItem("checkedByUser", employeeNames.checkedByUser)
          if (employeeNames.approvedByUser) localStorage.setItem("approvedByUser", employeeNames.approvedByUser)
          if (employeeNames.receivedByUser) localStorage.setItem("receivedByUser", employeeNames.receivedByUser)
        }
      } catch (error) {
        console.error("Error fetching approval settings:", error)
      }
    }

    fetchApprovalSettings()
  }, [])

  // check if a date is the same as today
  const checkIsSameDay = (dateToCheck) => {
    if (!dateToCheck) return false

    const today = new Date()
    const checkDate = new Date(dateToCheck)

    return (
      checkDate.getFullYear() === today.getFullYear() &&
      checkDate.getMonth() === today.getMonth() &&
      checkDate.getDate() === today.getDate()
    )
  }

  // Refresh PRF data
  const refreshPrfData = async () => {
    if (!prfId || !purchaseCodeNumber) return

    try {
      console.log("Refreshing PRF data for:", { prfId, purchaseCodeNumber })

      const response = await fetch(
        `http://localhost:5000/api/search-prf?prfNo=${encodeURIComponent(purchaseCodeNumber)}`,
      )

      if (response.ok) {
        const data = await response.json()

        if (data.found) {
          // Get PRF date
          const prfDateObj = new Date(data.header.prfDate)
          setPrfDate(prfDateObj)

          // Check if PRF date is today
          const sameDay = checkIsSameDay(prfDateObj)
          setIsSameDay(sameDay)

          // Check if PRF is cancelled in the database
          // Look in multiple places for the cancel status
          const isDbCancelled =
            (data.header && data.header.prfIsCancel === 1) ||
            (data.header && data.header.isCancel === 1) ||
            data.isCancel === 1

          console.log("Database cancel status:", isDbCancelled)

          // A PRF is considered cancelled if it's marked as cancelled in the database
          // OR if it's not created today (past the creation day)
          // const isCancelled = isDbCancelled

          // A PRF is considered cancelled ONLY if it's marked as cancelled in the database
          const isCancelled = isDbCancelled

          // Important: Update the state with the database value
          setIsPrfCancelled(isCancelled)

          // Update button label
          if (isDbCancelled) {
            setCancelButtonLabel("Cancelled")
          } else {
            setCancelButtonLabel("Cancel")
          }

          console.log("Updated state after refresh:", {
            sameDay,
            isDbCancelled,
            isCancelled,
            isPrfCancelled: isCancelled,
          })
        }
      }
    } catch (error) {
      console.error("Error refreshing PRF data:", error)
    }
  }

  useEffect(() => {
    if (location.state && location.state.company) {
      setCompany(location.state.company)
    } else {
      alert("No company selected. Please login again.")
      navigate("/login")
    }
  }, [location.state, navigate])

  // Generate a unique purchase code
  useEffect(() => {
    if (company) {
      generatePurchaseCode(company)
    }
  }, [company])

  // Listen for search results from App-layout.jsx
  useEffect(() => {
    const handleSearchResults = () => {
      const searchResultsStr = sessionStorage.getItem("prfSearchResults")
      if (searchResultsStr) {
        const data = JSON.parse(searchResultsStr)

        // Set the PRF header information
        setPurchaseCodeNumber(data.header.prfNo)
        setCurrentDate(data.header.prfDate.split("T")[0])
        setPrfId(data.header.prfId)

        // Get PRF date
        const prfDateObj = new Date(data.header.prfDate)
        setPrfDate(prfDateObj)

        // Check if PRF date is today
        const sameDay = checkIsSameDay(prfDateObj)
        setIsSameDay(sameDay)

        // Check if the PRF is cancelled from the response
        const isDbCancelled = data.header.prfIsCancel === 1 || data.isCancel === 1
        const isCancelled = isDbCancelled

        setIsPrfCancelled(isCancelled)

        // Set the cancel button label
        if (isDbCancelled) {
          setCancelButtonLabel("Cancelled")
        } else {
          setCancelButtonLabel("Cancel")
        }

        console.log("Search results - Button visibility:", {
          sameDay,
          isDbCancelled,
          isCancelled,
        })

        // Set the PRF details in the table
        const newRows = data.details.map((detail) => ({
          stockCode: detail.StockCode,
          quantity: detail.quantity ? detail.quantity.toString() : "",
          unit: detail.unit,
          description: detail.StockName || detail.description,
          dateNeeded: detail.dateNeeded,
          purpose: detail.purpose,
          stockId: detail.stockId || detail.StockCode || "",
        }))

        while (newRows.length < 5) {
          newRows.push({
            stockCode: "",
            quantity: "",
            unit: "",
            description: "",
            dateNeeded: "",
            purpose: "",
            stockId: "",
          })
        }

        setRows(newRows)
        setIsUpdating(true) // Set to update mode since we're loading existing data

        // Clear the session storage
        sessionStorage.removeItem("prfSearchResults")
      }
    }

    // Create new form
    const handleNewForm = () => {
      // Reset all fields
      const today = new Date()
      setCurrentDate(today.toISOString().split("T")[0])
      setPrfId(null)
      setPrfDate(today)
      setIsUpdating(false)
      setIsPrfCancelled(false)
      setCancelButtonLabel("Cancel")
      setIsSameDay(true)

      // Generate a new purchase code
      generatePurchaseCode(company)

      // Reset rows to empty state
      setRows(
        Array.from({ length: 5 }, () => ({
          stockCode: "",
          quantity: "",
          unit: "",
          description: "",
          dateNeeded: "",
          purpose: "",
          stockId: "",
        })),
      )
      // Reset Approval names
      setApprovalNames({
        checkedByUser: "",
        approvedByUser: "",
        receivedByUser: "",
      })
    }

    // Check for existing search results when component mounts
    handleSearchResults()

    // Listen for future search events and new form events
    window.addEventListener("prfSearchCompleted", handleSearchResults)
    window.addEventListener("prfNewForm", handleNewForm)

    return () => {
      window.removeEventListener("prfSearchCompleted", handleSearchResults)
      window.removeEventListener("prfNewForm", handleNewForm)
    }
  }, [company]) // Add company as a dependency since we use it in handleNewForm

  // Add a focus/visibility event listener to refresh data when returning to the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && prfId && purchaseCodeNumber) {
        refreshPrfData()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Also refresh when the component mounts if we have a prfId and purchaseCodeNumber
    if (prfId && purchaseCodeNumber) {
      refreshPrfData()
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [prfId, purchaseCodeNumber]) // Add purchaseCodeNumber as a dependency

  const [rows, setRows] = useState(
    Array.from({ length: 5 }, () => ({
      stockCode: "",
      quantity: "",
      unit: "",
      description: "",
      dateNeeded: "",
      purpose: "",
      stockId: "", // Add stockId field
    })),
  )

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRowIndex, setSelectedRowIndex] = useState(null)

  // Function to handle stock selection
  const handleStockSelect = (stock) => {
    if (selectedRowIndex !== null) {
      console.log("Selected stock:", stock) // Log the entire stock object
      console.log("Stock Id:", stock.Id) // Log the Id specifically

      const newRows = [...rows]
      newRows[selectedRowIndex].stockCode = stock.StockCode
      newRows[selectedRowIndex].unit = stock.BaseUOM
      newRows[selectedRowIndex].description = stock.StockName
      newRows[selectedRowIndex].stockId = stock.Id // Store the stock Id
      setRows(newRows)
    }
  }

  // Function to handle UOM selection
  const handleUomSelect = (uom) => {
    console.log("Selected UOM:", uom)

    if (selectedUomRowIndex !== null) {
      const newRows = [...rows]
      newRows[selectedUomRowIndex].unit = uom
      setRows(newRows)
    }
  }

  const handleInputChange = (index, event) => {
    const { name, value } = event.target
    const newRows = [...rows]

    if (name === "quantity") {
      // Validation for integers
      if (/^\d*$/.test(value)) {
        newRows[index][name] = value
        setRows(newRows)
      } else {
        alert("Please enter a valid integer for quantity.")
      }
    } else if (name === "dateNeeded") {
      // Validation for MM/DD/YYYY format
      if (value.length === 10) {
        const datePattern = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/
        if (!datePattern.test(value)) {
          alert("Please enter a valid date in MM/DD/YYYY format.")
          return
        }
      }
      newRows[index][name] = value
      setRows(newRows)
    } else {
      newRows[index][name] = value
      setRows(newRows)

      // Reset styling for purpose field when user starts typing
      if (name === "purpose") {
        event.target.style.border = ""
        event.target.placeholder = ""
      }
    }
  }

  const handleDateChange = (event) => {
    setCurrentDate(event.target.value)
  }

  // Function to generate a unique purchase code based on company name
  const generatePurchaseCode = (companyName) => {
    // Map company names to their specific code letters
    const companyCodeMap = {
      "NutraTech Biopharma, Inc": "N",
      "Avli Biocare, Inc": "B",
      "Apthealth, Inc": "P",
    }

    // Get the correct letter for the company
    const codeLetter = companyCodeMap[companyName] || companyName.charAt(0).toUpperCase()

    // Generate 5 random digits
    const randomDigits = Math.floor(10000 + Math.random() * 90000)

    // Set the purchase code
    const newCode = `${codeLetter} ${randomDigits}`
    setPurchaseCodeNumber(newCode)
  }

  // Function after generate PurchaseCode function
  const handleSavePrfHeader = async () => {
    if (!purchaseCodeNumber || !currentDate || !fullname) {
      console.error("Missing required data for PRF header")
      return null
    }

    const departmentId = localStorage.getItem("userDepartmentId")

    const prfHeaderData = {
      departmentId: departmentId,
      prfNo: purchaseCodeNumber,
      prfDate: currentDate,
      preparedBy: fullname,
    }

    try {
      const response = await fetch("http://localhost:5000/api/save-table-header", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prfHeaderData),
      })

      const data = await response.json()
      if (response.ok) {
        console.log("PRF header saved:", data.prfId) // Get PRF ID from backend
        setPrfId(data.prfId) // Store the backend-generated PRF ID
        setPrfDate(new Date(currentDate)) // Store the PRF date
        return data.prfId // Return PRF ID from backend
      } else {
        console.error("Error saving PRF header:", data.message)
        return null
      }
    } catch (error) {
      console.error("Failed to save PRF header:", error)
      return null
    }
  }

  const headerLogos = {
    "NutraTech Biopharma, Inc": nutraheaderlogo,
    "Avli Biocare, Inc": avliheaderLogo,
    "Apthealth, Inc": apthealtheaderLogo,
  }

  const companyLogos = {
    "NutraTech Biopharma, Inc": NutraTechlogo,
    "Avli Biocare, Inc": avliLogo,
    "Apthealth, Inc": apthealthLogo,
  }

  const handleSave = async () => {
    // Check if there are any rows with stock codes
    const validRows = rows.filter((row) => row.stockCode && row.stockCode.trim())
    if (validRows.length === 0) {
      alert("Please fill out PRF details first before saving")
      return
    }

    // Check if any row with a stock code has an empty purpose field
    const hasEmptyPurpose = rows.some((row) => row.stockCode && !row.purpose.trim())

    if (hasEmptyPurpose) {
      alert("Purpose of Requisition is required for all items")
      // Highlight the empty purpose fields
      const purposeInputs = document.querySelectorAll('input[name="purpose"]')
      rows.forEach((row, index) => {
        if (row.stockCode && !row.purpose.trim()) {
          purposeInputs[index].style.border = "1px solid red"
          purposeInputs[index].placeholder = "Required field"
        }
      })
      return
    }

    let headerPrfId = prfId

    if (!headerPrfId) {
      headerPrfId = await savePrfHeader(purchaseCodeNumber, currentDate, fullname)
    }

    const success = await savePrfDetails(headerPrfId, rows)
    if (success) {
      setPrfId(headerPrfId)
    }
  }

  // Function to handle updating PRF details
  const handleUpdate = async () => {
    const success = await updatePrfDetails(prfId, rows)
    if (success) {
      setIsUpdating(false)
    }
  }

  const handleAddRow = () => {
    setRows([
      ...rows,
      { stockCode: "", quantity: "", unit: "", description: "", dateNeeded: "", purpose: "", stockId: "" },
    ])
  }

  const handleCancel = async () => {
    // Don't allow cancellation if not on the same day
    if (!isSameDay || isPrfCancelled) {
      alert("PRF can only be cancelled on the same day it was created")
      return
    }

    const result = await cancelPrf(prfId)
    if (result && result.success) {
      // Update the button label
      setCancelButtonLabel("Cancelled")

      // Update the cancelled state - make sure this is set to true
      setIsPrfCancelled(true)

      console.log("PRF cancelled successfully, updating state:", {
        isPrfCancelled: true,
        isSameDay,
      })

      // Force a direct API call to verify the cancellation was successful
      try {
        const verifyResponse = await axios.get(
          `http://localhost:5000/api/search-prf?prfNo=${encodeURIComponent(purchaseCodeNumber)}`,
        )

        if (verifyResponse.data && verifyResponse.data.found) {
          const isDbCancelled =
            (verifyResponse.data.header && verifyResponse.data.header.prfIsCancel === 1) ||
            verifyResponse.data.isCancel === 1

          console.log("Verification of cancel status:", isDbCancelled)

          if (!isDbCancelled) {
            console.warn("Warning: Database does not show PRF as cancelled despite successful cancel operation")
            alert(
              "Warning: The PRF may not have been properly cancelled in the database. Please try again or contact support.",
            )
          }
        }
      } catch (error) {
        console.error("Error verifying cancellation:", error)
      }
    }
  }

  const handleUncancel = async () => {
    // Don't allow uncancellation if not on the same day
    if (!isSameDay) {
      alert("PRF can only be uncancelled on the same day it was created")
      return
    }

    console.log("Uncancelling PRF with ID:", prfId)
    console.log("Current state before uncancel:", { isPrfCancelled, isSameDay })

    // First verify if the PRF is actually cancelled in the database
    try {
      const verifyResponse = await axios.get(
        `http://localhost:5000/api/search-prf?prfNo=${encodeURIComponent(purchaseCodeNumber)}`,
      )

      if (verifyResponse.data && verifyResponse.data.found) {
        const isDbCancelled =
          (verifyResponse.data.header && verifyResponse.data.header.prfIsCancel === 1) ||
          verifyResponse.data.isCancel === 1

        console.log("Verification of cancel status before uncancel:", isDbCancelled)

        if (!isDbCancelled) {
          console.warn("Warning: Database does not show PRF as cancelled, cannot uncancel")
          alert("This PRF is not marked as cancelled in the database. Refreshing data...")
          refreshPrfData()
          return
        }
      }
    } catch (error) {
      console.error("Error verifying cancellation status:", error)
      // Continue with uncancel attempt even if verification fails
    }

    const result = await uncancelPrf(prfId)
    console.log("Uncancel result:", result)

    if (result) {
      if (result.success) {
        // Update the button label
        setCancelButtonLabel("Cancel")

        // Update the cancelled state
        setIsPrfCancelled(false)

        console.log("PRF uncancelled successfully, updating state:", {
          isPrfCancelled: false,
          isSameDay,
        })

        // Refresh data after a short delay to ensure the backend has updated
        setTimeout(() => {
          refreshPrfData()
        }, 1000)
      } else if (result.needsRefresh) {
        // If the backend state doesn't match our frontend state, refresh the data
        console.log("Frontend/backend state mismatch, refreshing data...")
        refreshPrfData()
      }
    }
  }

  // Style for cancelled items
  const cancelledStyle = {
    color: isPrfCancelled ? "red" : "inherit",
  }

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("prfFormStateChanged", {
        detail: {
          isUpdating,
          isPrfCancelled,
          isSameDay,
        },
      }),
    )
  }, [isUpdating, isPrfCancelled, isSameDay])

  useEffect(() => {
    const handleSaveClick = async () => {
      console.log("Save clicked - Form data:", { purchaseCodeNumber, currentDate, fullname })

      // Check if there are any rows with stock codes
      const validRows = rows.filter((row) => row.stockCode && row.stockCode.trim())
      if (validRows.length === 0) {
        alert("Please fill out PRF details first before saving")
        return
      }

      let headerPrfId = prfId

      if (!headerPrfId) {
        headerPrfId = await savePrfHeader(purchaseCodeNumber, currentDate, fullname)
      }

      if (headerPrfId) {
        const success = await savePrfDetails(headerPrfId, rows)
        if (success) {
          setPrfId(headerPrfId)
        }
      } else {
        console.error("Failed to save PRF header")
      }
    }

    const handleUpdateClick = async () => {
      console.log("Update clicked")

      // Check if any row with a stock code has an empty purpose field
      const hasEmptyPurpose = rows.some((row) => row.stockCode && !row.purpose.trim())

      if (hasEmptyPurpose) {
        alert("Purpose of Requisition is required for all items")
        // Highlight the empty purpose fields
        const purposeInputs = document.querySelectorAll('input[name="purpose"]')
        rows.forEach((row, index) => {
          if (row.stockCode && !row.purpose.trim()) {
            purposeInputs[index].style.border = "1px solid red"
            purposeInputs[index].placeholder = "Required field"
          }
        })
        return
      }

      const success = await updatePrfDetails(prfId, rows)
      if (success) {
        setIsUpdating(false)
      }
    }

    window.addEventListener("prfSaveClicked", handleSaveClick)
    window.addEventListener("prfUpdateClicked", handleUpdateClick)

    return () => {
      window.removeEventListener("prfSaveClicked", handleSaveClick)
      window.removeEventListener("prfUpdateClicked", handleUpdateClick)
    }
  }, [rows, prfId, purchaseCodeNumber, currentDate, fullname])

  // Determine if buttons should be shown based on same day check
  const showActionButtons = isSameDay && isUpdating

  return (
    <>
      <div className="form-container">
        <div className="form-box-container">
          {isPrfCancelled && (
            <div
              className="cancelled-banner"
              style={{
                backgroundColor: "rgba(255, 0, 0, 0.1)",
                padding: "10px",
                textAlign: "center",
                fontWeight: "bold",
                color: "red",
                marginBottom: "10px",
                border: "1px solid red",
                borderRadius: "4px",
              }}
            >
              This PRF has been cancelled
            </div>
          )}

          <div className="header">
            <div>
              <div className="logo">
                <img src={companyLogos[company] || "/placeholder.svg"} alt="Company Logo" />
              </div>
              <h3 className="header-three">Brgy. Balubad II, Silang Cavite, Philippines</h3>
              <h3 className="header-four">Tels.: • (02) 579-0954 • (02) 986-0729 • (02) 925-9515</h3>
            </div>
          </div>

          <div className="form-header">
            <div className="purchase-code-number" style={cancelledStyle}>
              <label style={{ color: isPrfCancelled ? "red" : "inherit" }}>No. {purchaseCodeNumber}</label>
            </div>
            <h1 className="header-one-label">PURCHASE REQUEST FORM</h1>
          </div>

          <div className="field-box">
            <div className="search-input-container-type">
              <label className="nutra-header-dept-label" htmlFor="department">
                Department (charge to):
              </label>
              <input type="text" id="department" className="department-type" value={department} readOnly />
            </div>

            <div className="nutra-date-container">
              <label className="nutra-date-label">Date:</label>
              <input
                type="date"
                id="date"
                className="input-date-nutra"
                value={currentDate}
                onChange={handleDateChange}
                required
              />
            </div>
          </div>

          <div className="following-label">
            <label>I would like to request the following :</label>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>
                    <label
                      onClick={() => {
                        if (!isPrfCancelled && isSameDay) {
                          setIsModalOpen(true)
                          setSelectedRowIndex(0)
                        }
                      }}
                      style={{ cursor: isPrfCancelled || !isSameDay ? "default" : "pointer" }}
                    >
                      STOCK CODE
                    </label>
                  </th>
                  <th>QUANTITY</th>
                  <th>
                    <label
                      onClick={() => {
                        if (!isPrfCancelled && isSameDay) {
                          setIsUomModalOpen(true)
                          setSelectedUomRowIndex(0)
                        }
                      }}
                      style={{ cursor: isPrfCancelled || !isSameDay ? "default" : "pointer" }}
                    >
                      UNIT
                    </label>
                  </th>
                  <th>DESCRIPTION</th>
                  <th>DATE NEEDED</th>
                  <th>PURPOSE OF REQUISITION</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td
                      onClick={() => {
                        if (!isPrfCancelled && isSameDay) {
                          setIsModalOpen(true)
                          setSelectedRowIndex(index)
                        }
                      }}
                      style={{ cursor: isPrfCancelled || !isSameDay ? "default" : "pointer" }}
                    >
                      <input
                        type="text"
                        name="stockCode"
                        value={row.stockCode}
                        readOnly
                        style={{ color: isPrfCancelled ? "red" : "inherit" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="quantity"
                        value={row.quantity}
                        onChange={(e) => handleInputChange(index, e)}
                        readOnly={isPrfCancelled || !isSameDay}
                        style={{ color: isPrfCancelled ? "red" : "inherit" }}
                      />
                    </td>
                    <td
                      onClick={() => {
                        if (!isPrfCancelled && isSameDay) {
                          setIsUomModalOpen(true)
                          setSelectedUomRowIndex(index)
                        }
                      }}
                      style={{ cursor: isPrfCancelled || !isSameDay ? "default" : "pointer" }}
                    >
                      <input
                        type="text"
                        name="unit"
                        value={row.unit}
                        onChange={(e) => handleInputChange(index, e)}
                        readOnly={isPrfCancelled || !isSameDay}
                        style={{ color: isPrfCancelled ? "red" : "inherit" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="description"
                        value={row.description}
                        onChange={(e) => handleInputChange(index, e)}
                        readOnly={isPrfCancelled || !isSameDay}
                        style={{ color: isPrfCancelled ? "red" : "inherit" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="dateNeeded"
                        value={row.dateNeeded}
                        onChange={(e) => handleInputChange(index, e)}
                        readOnly={isPrfCancelled || !isSameDay}
                        style={{ color: isPrfCancelled ? "red" : "inherit" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="purpose"
                        value={row.purpose}
                        onChange={(e) => handleInputChange(index, e)}
                        readOnly={isPrfCancelled || !isSameDay}
                        style={{ color: isPrfCancelled ? "red" : "inherit" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="save-button-container">
            <AddRowButton onClick={handleAddRow} disabled={isPrfCancelled || !isSameDay} />

            {showActionButtons && (
              <div className="action-buttons">
                <CancelButton
                  onClick={handleCancel}
                  disabled={isPrfCancelled || !isSameDay}
                  label={cancelButtonLabel}
                />
                {/* Always show the uncancel button, but only enable it when the PRF is cancelled */}
                <UncancelButton onClick={handleUncancel} disabled={!isPrfCancelled} label="Uncancel" />
              </div>
            )}
          </div>

          {isModalOpen && <StockcodeModal onClose={() => setIsModalOpen(false)} onSelectStock={handleStockSelect} />}
          {isUomModalOpen && (
            <UomModal
              onClose={() => setIsUomModalOpen(false)}
              onSelectUom={handleUomSelect}
              stockId={rows[selectedUomRowIndex]?.stockId || rows[selectedUomRowIndex]?.stockCode || "all"} // Pass stockId, stockCode, or 'all'
            />
          )}

          <div className="approval-section">
            <div className="approval-box">
              <h3>Prepared By:</h3>
              <div className="signature-box">{fullname}</div>{" "}
              <p className="signature-label">Signature over printed Name / Date</p>
            </div>

            <div className="approval-box">
              <h3>Checked By:</h3>
              <div className="signature-box">{approvalNames.checkedByUser}</div>
              <p className="signature-label">Signature over printed Name / Date</p>
            </div>

            <div className="approval-box">
              <h3>Approved By:</h3>
              <div className="signature-box">{approvalNames.approvedByUser}</div>
              <p className="signature-label">Signature over printed Name / Date</p>
            </div>

            <div className="approval-box">
              <h3>Received By:</h3>
              <div className="signature-box">{approvalNames.receivedByUser}</div>
              <p className="signature-label">Date / Time / Signature</p>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        input:read-only {
          background-color: ${isPrfCancelled ? "rgba(255, 0, 0, 0.05)" : "inherit"};
        }
        
        .uncancel-button {
          background-color: #4caf50;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.3s;
          margin-left: 8px;
        }
        
        .uncancel-button:hover {
          background-color: #45a049;
        }
        
        .uncancel-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .action-buttons {
          display: flex;
          gap: 8px;
          margin-left: 8px;
        }
      `}</style>
    </>
  )
}

export default NutraTechForm
